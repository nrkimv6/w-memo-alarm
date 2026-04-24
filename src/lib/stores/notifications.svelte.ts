import type { Memo, Reminder } from '$lib/types/memo';
import { memosStore } from './memos.svelte';
import { notificationHistoryStore } from './notificationHistory.svelte';
import { createLogger, devLogStore } from './devLogs.svelte';
import { getCurrentTimeHHMM, getTodayDateISO } from '$lib/utils/timeUtils';
import { SW_MSG } from '$lib/constants/swMessages';
import { buildMergedTitle, buildMergedBody } from '$lib/utils/notificationMerge';

// 메모에서 알림 목록 가져오기 (하위 호환성)
function getRemindersFromMemo(memo: Memo): Reminder[] {
	if (memo.reminders && memo.reminders.length > 0) {
		return memo.reminders;
	}
	if (memo.reminder) {
		return [memo.reminder];
	}
	return [];
}

const STORAGE_KEY = 'memo-alarm:last-notifications';
const SNOOZE_KEY = 'memo-alarm:snoozed-reminders';

export type SnoozeMinutes = 5 | 10 | 30 | 60;

interface SnoozedReminder {
	memoId: string;
	snoozeUntil: number; // timestamp
}

// 개발자 모드 로그
const log = createLogger('Notification');

// SW "activating" race 방어: registration.active가 fully activated 상태가 될 때까지 대기
async function awaitActivatedServiceWorker(): Promise<ServiceWorker | null> {
	if (!('serviceWorker' in navigator)) return null;
	try {
		const registration = await navigator.serviceWorker.ready;
		if (!registration.active) return null;
		if (registration.active.state === 'activated') return registration.active;
		// activating 상태 — statechange 이벤트로 activated 대기 (8초 timeout)
		return await new Promise<ServiceWorker | null>((resolve) => {
			const sw = registration.active!;
			const timer = setTimeout(() => {
				sw.removeEventListener('statechange', onStateChange);
				resolve(null);
			}, 8000);
			function onStateChange() {
				if (sw.state === 'activated') {
					clearTimeout(timer);
					sw.removeEventListener('statechange', onStateChange);
					resolve(sw);
				} else if (sw.state === 'redundant') {
					clearTimeout(timer);
					sw.removeEventListener('statechange', onStateChange);
					resolve(null);
				}
			}
			sw.addEventListener('statechange', onStateChange);
		});
	} catch {
		return null;
	}
}

function createNotificationStore() {
	let permission = $state<NotificationPermission>('default');
	let initialized = $state(false);
	let checkInterval: ReturnType<typeof setInterval> | null = null;
	let lastNotifiedMap = $state<Record<string, string>>({});
	let snoozedReminders = $state<SnoozedReminder[]>([]);

	// 활성 리마인더가 있는 메모만 사전 필터링 (매번 전체 memos 순회 방지)
	const activeReminderMemos = $derived(
		memosStore.memos.filter(m => {
			const reminders = getRemindersFromMemo(m);
			return reminders.some(r => r.enabled);
		})
	);

	// SW 재등록 트리거용 fingerprint: payload 내용 전체를 직렬화해 count 기반 false negative 방지
	const activeReminderSyncKey = $derived(
		activeReminderMemos
			.flatMap(m =>
				getRemindersFromMemo(m)
					.filter(r => r.enabled)
					.map(r => ({
						memoId: m.id,
						reminderId: r.id,
						time: r.time,
						type: r.type,
						days: [...(r.days ?? [])].sort((a, b) => a - b),
						date: r.date ?? null,
						title: m.title,
						body: m.content ?? '',
						url: m.url ?? null,
						autoOpen: r.autoOpen ?? false
					}))
			)
			.sort((a, b) => `${a.memoId}:${a.reminderId}`.localeCompare(`${b.memoId}:${b.reminderId}`))
			.map(r => JSON.stringify(r))
			.join('|')
	);

	function loadLastNotified() {
		if (typeof window === 'undefined') return;
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				lastNotifiedMap = JSON.parse(saved);
			}
		} catch (e) {
			console.error('Failed to load last notifications:', e);
		}
	}

	function saveLastNotified() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(lastNotifiedMap));
		} catch (e) {
			console.error('Failed to save last notifications:', e);
		}
	}

	function loadSnoozed() {
		if (typeof window === 'undefined') return;
		try {
			const saved = localStorage.getItem(SNOOZE_KEY);
			if (saved) {
				snoozedReminders = JSON.parse(saved);
				// Clean up expired snoozes
				const now = Date.now();
				snoozedReminders = snoozedReminders.filter(s => s.snoozeUntil > now);
				saveSnoozed();
			}
		} catch (e) {
			console.error('Failed to load snoozed reminders:', e);
		}
	}

	function saveSnoozed() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozedReminders));
		} catch (e) {
			console.error('Failed to save snoozed reminders:', e);
		}
	}

	function snooze(memoId: string, minutes: SnoozeMinutes) {
		const snoozeUntil = Date.now() + minutes * 60 * 1000;
		snoozedReminders = snoozedReminders.filter(s => s.memoId !== memoId);
		snoozedReminders = [...snoozedReminders, { memoId, snoozeUntil }];
		saveSnoozed();
	}

	function cancelSnooze(memoId: string) {
		snoozedReminders = snoozedReminders.filter(s => s.memoId !== memoId);
		saveSnoozed();
	}

	function getSnoozedUntil(memoId: string): number | null {
		const snoozed = snoozedReminders.find(s => s.memoId === memoId);
		return snoozed?.snoozeUntil ?? null;
	}

	function init() {
		if (initialized || typeof window === 'undefined') {
			log.debug(`init skipped: initialized=${initialized}`);
			return;
		}

		log.info('🚀 Initializing notification store...');

		if ('Notification' in window) {
			permission = Notification.permission;
			log.info(`Permission: ${permission}`);
		} else {
			log.warn('❌ Notification API not supported');
		}

		// SW에서 보낸 로그 및 알림 발송 기록 수신
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.addEventListener('message', (event) => {
				if (event.data.type === SW_MSG.SW_LOG) {
					devLogStore.add(
						event.data.level || 'info',
						event.data.source || 'SW',
						event.data.message,
						event.data.data
					);
				}
				if (event.data.type === SW_MSG.NOTIFICATION_SENT) {
					notificationHistoryStore.addRecord({
						memoId: event.data.memoId,
						memoTitle: event.data.memoTitle,
						reminderId: event.data.reminderId || '',
						reminderType: event.data.reminderType || 'default',
						channel: event.data.channel || 'sw-push',
						status: event.data.status,
						errorMessage: event.data.errorMessage || undefined,
						sentAt: event.data.sentAt
					});
					log.info(`SW memo notification record: ${event.data.memoTitle} (${event.data.status})`);
				}
				if (event.data.type === SW_MSG.TODO_NOTIFICATION_SENT) {
					const memo = memosStore.getById(event.data.memoId);
					const memoTitle = memo?.title ?? '(unknown todo)';
					notificationHistoryStore.addRecord({
						memoId: event.data.memoId,
						memoTitle,
						reminderId: event.data.notificationId || '',
						reminderType: event.data.notificationType || 'todo-remind',
						channel: 'sw-todo',
						status: event.data.status,
						errorMessage: event.data.errorMessage || undefined,
						sentAt: event.data.sentAt
					});
					log.info(`SW todo notification record: ${memoTitle} (${event.data.status})`);
				}
				// autoOpen으로 외부 URL이 열린 경우 openCount 증가
				if (event.data.type === 'AUTO_OPEN_TRIGGERED' && event.data.memoId) {
					memosStore.incrementOpenCount(event.data.memoId);
					log.info(`Auto-open triggered for memo: ${event.data.memoId}`);
				}
			});
			log.info('SW message listener registered');
		}

		loadLastNotified();
		loadSnoozed();
		startBackgroundCheck();
		initialized = true;
		log.info('✅ Notification store initialized');
		// NOTE: SW registration is now called explicitly from +layout.svelte after memosStore.init() completes
	}

	function startBackgroundCheck() {
		if (checkInterval) {
			log.debug('Background check already running');
			return;
		}

		log.info('Starting background check (interval: 60s)');
		log.warn('⚠️ setInterval은 백그라운드에서 동작하지 않음!');

		// Check every minute
		checkInterval = setInterval(() => {
			log.info(`🔄 Interval triggered at ${new Date().toLocaleTimeString()}`);
			checkAndTriggerReminders();
		}, 60000);

		// Initial check
		log.info('Running initial check...');
		checkAndTriggerReminders();
	}

	function stopBackgroundCheck() {
		if (checkInterval) {
			clearInterval(checkInterval);
			checkInterval = null;
		}
	}

	function checkAndTriggerReminders() {
		log.info(`🕐 checkAndTriggerReminders at ${new Date().toLocaleTimeString()}`);

		if (permission !== 'granted') {
			log.warn(`❌ Permission not granted: ${permission}`);
			return;
		}

		const now = new Date();
		const nowTimestamp = now.getTime();
		const currentTime = getCurrentTimeHHMM(now);
		const today = now.getDay();
		const todayDate = getTodayDateISO(now);

		log.info(`📅 time=${currentTime}, date=${todayDate}, day=${today}`);

		// Check snoozed reminders (스누즈 해제 시점은 제각각 — 병합 대상 아님)
		if (snoozedReminders.length > 0) {
			log.info(`Snoozed: ${snoozedReminders.length}`);
		}
		snoozedReminders.forEach((snoozed) => {
			if (snoozed.snoozeUntil <= nowTimestamp) {
				const memo = memosStore.getById(snoozed.memoId);
				if (memo) {
					log.info(`⏰ Triggering snoozed: ${memo.title}`);
					showNotification(memo, true);
					// autoOpen 처리는 서비스 워커에서 처리 (notificationclick)
				}
				cancelSnooze(snoozed.memoId);
			}
		});

		// Check regular reminders (activeReminderMemos: 사전 필터링된 derived 스토어)
		log.info(`📋 Active reminders: ${activeReminderMemos.length}`);

		// 수집 단계: 발송 대상 memo + 매칭된 active reminder 모아두기
		const toFire: Array<{ memo: Memo; active: Reminder }> = [];

		activeReminderMemos.forEach((memo) => {
			const rems = getRemindersFromMemo(memo);
			const active = rems.find(r => r.enabled && r.time === currentTime);
			if (!active) return;

			log.info(`⏱️ Time match: "${memo.title}" (${active.time})`);

			// Check if already notified
			const notifyKey = `${todayDate}-${active.time}`;
			if (lastNotifiedMap[memo.id] === notifyKey) {
				log.debug(`⏩ Already notified: ${notifyKey}`);
				return;
			}

			// Check day/date conditions
			const isOnce = active.type === 'once';
			if (isOnce) {
				if (active.date !== todayDate) {
					log.debug(`❌ Date mismatch: ${active.date} != ${todayDate}`);
					return;
				}
				log.info(`✅ Date match: ${todayDate}`);
			} else {
				if (!active.days?.includes(today)) {
					log.debug(`❌ Day mismatch: ${JSON.stringify(active.days)} !includes ${today}`);
					return;
				}
				log.info(`✅ Day match: ${today}`);
			}

			toFire.push({ memo, active });
		});

		if (toFire.length === 0) return;

		// 발송 전 일괄 상태 업데이트 (동시 재진입 중복 방지)
		const notifyKey = `${todayDate}-${currentTime}`;
		toFire.forEach(({ memo, active }) => {
			lastNotifiedMap[memo.id] = notifyKey;
			if (active.type === 'once') {
				log.info(`🔕 Disabling one-time: "${memo.title}"`);
				memosStore.updateReminderEnabled(memo.id, active.id, false);
			}
		});
		saveLastNotified();

		// 발송 단계: 1건이면 단일 알림, 2건 이상이면 병합
		log.info(`🔔 TRIGGERING: ${toFire.length}건`);
		if (toFire.length === 1) {
			showNotification(toFire[0].memo);
		} else {
			showMergedForeground(toFire.map(f => f.memo), currentTime);
		}
	}

	async function showMergedForeground(memos: Memo[], time: string): Promise<void> {
		log.info(`🔔 showMergedForeground: ${memos.length}건`);

		const sentAt = new Date().toISOString();
		const options: NotificationOptions = {
			body: buildMergedBody(memos.map(m => m.title)),
			icon: '/favicon.png',
			tag: `memo-batch-${time}`,
			data: { memoIds: memos.map(m => m.id), url: '/', type: 'merged', time },
			requireInteraction: true
		};

		try {
			if ('serviceWorker' in navigator) {
				const registration = await navigator.serviceWorker.ready;
				await registration.showNotification(buildMergedTitle(memos.length), options);
			} else {
				// SW 미가용 fallback: 병합 알림 1건만 발송 (개별 반복 금지)
				const n = new Notification(buildMergedTitle(memos.length), options);
				n.onclick = () => { window.focus(); location.href = '/'; n.close(); };
			}
			memos.forEach(m => {
				const reminders = getRemindersFromMemo(m);
				const active = reminders.find(r => r.enabled) || reminders[0];
				notificationHistoryStore.addRecord({
					memoId: m.id,
					memoTitle: m.title,
					reminderId: active?.id || '',
					reminderType: active?.isDefault ? 'default' : 'additional',
					channel: 'sw-push',
					status: 'success',
					sentAt
				});
			});
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : String(e);
			memos.forEach(m => {
				const reminders = getRemindersFromMemo(m);
				const active = reminders.find(r => r.enabled) || reminders[0];
				notificationHistoryStore.addRecord({
					memoId: m.id,
					memoTitle: m.title,
					reminderId: active?.id || '',
					reminderType: active?.isDefault ? 'default' : 'additional',
					channel: 'sw-push',
					status: 'failed',
					errorMessage: errorMsg,
					sentAt
				});
			});
		}
	}

	async function requestPermission(): Promise<boolean> {
		if (!('Notification' in window)) {
			console.warn('Notifications not supported');
			return false;
		}

		try {
			const result = await Notification.requestPermission();
			permission = result;
			return result === 'granted';
		} catch (e) {
			console.error('Failed to request notification permission:', e);
			return false;
		}
	}

	function showNotification(memo: Memo, isSnoozed = false): void {
		log.info(`📢 showNotification: "${memo.title}", snoozed=${isSnoozed}`);

		if (permission !== 'granted') {
			log.warn(`❌ Permission denied: ${permission}`);
			return;
		}

		const title = isSnoozed ? `⏰ ${memo.title}` : memo.title;
		const options: NotificationOptions = {
			body: memo.content || '알림이 도착했습니다',
			icon: '/favicon.png',
			tag: memo.id,
			data: { memoId: memo.id, url: memo.url },
			requireInteraction: true
		};

		const reminders = getRemindersFromMemo(memo);
		const activeReminder = reminders.find(r => r.enabled);

		if ('serviceWorker' in navigator) {
			log.info('Using Service Worker');
			navigator.serviceWorker.ready.then((registration) => {
				log.info('SW ready, showing...');
				try {
					registration.showNotification(title, options);
					notificationHistoryStore.addRecord({
						memoId: memo.id,
						memoTitle: memo.title,
						reminderId: activeReminder?.id || '',
						reminderType: activeReminder?.isDefault ? 'default' : 'additional',
						channel: 'sw-push',
						status: 'success',
						sentAt: new Date().toISOString()
					});
				} catch (e) {
					const errorMsg = e instanceof Error ? e.message : String(e);
					notificationHistoryStore.addRecord({
						memoId: memo.id,
						memoTitle: memo.title,
						reminderId: activeReminder?.id || '',
						reminderType: activeReminder?.isDefault ? 'default' : 'additional',
						channel: 'sw-push',
						status: 'failed',
						errorMessage: errorMsg,
						sentAt: new Date().toISOString()
					});
				}
			});
		} else {
			log.info('Using native Notification API');
			try {
				const notification = new Notification(title, options);
				notification.onclick = () => {
					window.focus();
					if (memo.url && memo.reminder?.autoOpen) {
						window.open(memo.url, '_blank');
						memosStore.incrementOpenCount(memo.id);
					}
					notification.close();
				};
				notificationHistoryStore.addRecord({
					memoId: memo.id,
					memoTitle: memo.title,
					reminderId: activeReminder?.id || '',
					reminderType: activeReminder?.isDefault ? 'default' : 'additional',
					channel: 'sw-push',
					status: 'success',
					sentAt: new Date().toISOString()
				});
			} catch (e) {
				const errorMsg = e instanceof Error ? e.message : String(e);
				notificationHistoryStore.addRecord({
					memoId: memo.id,
					memoTitle: memo.title,
					reminderId: activeReminder?.id || '',
					reminderType: activeReminder?.isDefault ? 'default' : 'additional',
					channel: 'sw-push',
					status: 'failed',
					errorMessage: errorMsg,
					sentAt: new Date().toISOString()
				});
			}
		}
	}

	function getTodayReminders(): Memo[] {
		const now = new Date();
		const today = now.getDay();
		const todayDate = getTodayDateISO(now);

		return activeReminderMemos.filter((memo) => {
			if (!memo.reminder?.enabled) return false;

			// Check if it's a one-time reminder
			if (memo.reminder.type === 'once') {
				return memo.reminder.date === todayDate;
			}

			// Repeating reminder: check day of week
			if (!memo.reminder.days?.includes(today)) return false;
			return true;
		}).sort((a, b) => {
			const timeA = a.reminder?.time || '00:00';
			const timeB = b.reminder?.time || '00:00';
			return timeA.localeCompare(timeB);
		});
	}

	function getUpcomingReminders(): Memo[] {
		const now = new Date();
		const currentTime = getCurrentTimeHHMM(now);

		return getTodayReminders().filter((memo) => {
			const reminderTime = memo.reminder?.time || '00:00';
			return reminderTime >= currentTime;
		});
	}

	function getPastReminders(): Memo[] {
		const now = new Date();
		const currentTime = getCurrentTimeHHMM(now);

		return getTodayReminders().filter((memo) => {
			const reminderTime = memo.reminder?.time || '00:00';
			return reminderTime < currentTime;
		});
	}

	// Service Worker에 알림 스케줄 등록
	async function registerRemindersToServiceWorker() {
		log.info('🔄 registerRemindersToServiceWorker() called');

		if (!('serviceWorker' in navigator)) {
			log.warn('❌ Service Worker not supported');
			return;
		}

		// 디버그: 현재 memos 상태 체크
		log.info(`📊 memosStore.memos.length = ${memosStore.memos.length}`);
		log.info(`📊 memosStore.initialized = ${memosStore.initialized}`);
		log.info(`📊 memosStore.loading = ${memosStore.loading}`);

		try {
			log.info('⏳ Waiting for SW activated...');
			const sw = await awaitActivatedServiceWorker();
			log.info(`✅ SW ready, state: ${sw?.state ?? 'null'}`);

			if (!sw) {
				log.warn('❌ No activated Service Worker (timeout or unavailable)');
				return;
			}

			// 활성화된 알림만 필터링 (reminders 배열 지원)
			// NOTE: Svelte 5의 $state는 Proxy 객체를 사용하므로 postMessage 전송 전 plain object로 변환 필요
			const activeReminders: unknown[] = [];

			activeReminderMemos.forEach((memo) => {
				const reminders = getRemindersFromMemo(memo);
				reminders.filter(r => r.enabled).forEach(r => {
					const reminder = {
						memoId: memo.id,
						reminderId: r.id,
						title: memo.title,
						body: memo.content || '알림이 도착했습니다',
						time: r.time,
						type: r.type,
						days: r.days,
						date: r.date,
						url: memo.url,
						autoOpen: r.autoOpen
					};
					// Proxy 객체를 plain object로 변환 (DataCloneError 방지)
					activeReminders.push(JSON.parse(JSON.stringify(reminder)));
				});
			});

			log.info(`📤 Registering ${activeReminders.length} reminders to SW`);
			if (activeReminders.length > 0) {
				const first = activeReminders[0] as { title: string; time: string };
				log.info(`📋 First reminder: ${first.title} at ${first.time}`);
			}

			sw.postMessage({
				type: SW_MSG.REGISTER_MEMO_REMINDERS,
				reminders: activeReminders
			});

			log.info('✅ postMessage sent to SW');
		} catch (e) {
			// 에러 상세 출력
			const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
			const errorStack = e instanceof Error ? e.stack : 'no stack';
			log.error(`Failed to register reminders to SW: ${errorMsg}`);
			log.error(`Stack: ${errorStack}`);
		}
	}

	// Service Worker와 알림 상태 동기화 (AlarmManager에서 사용)
	function syncRemindersToServiceWorker() {
		registerRemindersToServiceWorker();
	}

	// Service Worker에 단일 알림 업데이트 (reminders 배열 지원)
	async function updateReminderInServiceWorker(memo: Memo) {
		const sw = await awaitActivatedServiceWorker();
		if (!sw) return;

		try {
			const reminders = getRemindersFromMemo(memo);
			const enabledReminders = reminders.filter(r => r.enabled);

			if (enabledReminders.length > 0) {
				// 활성화된 모든 알림 등록
				enabledReminders.forEach(r => {
					const reminderData = JSON.parse(JSON.stringify({
						memoId: memo.id,
						reminderId: r.id,
						title: memo.title,
						body: memo.content || '알림이 도착했습니다',
						time: r.time,
						type: r.type,
						days: r.days,
						date: r.date,
						url: memo.url,
						autoOpen: r.autoOpen
					}));
					sw.postMessage({
						type: SW_MSG.UPDATE_MEMO_REMINDER,
						reminder: reminderData
					});
				});
				log.info(`📤 Updated ${enabledReminders.length} reminders in SW: "${memo.title}"`);
			} else {
				sw.postMessage({
					type: SW_MSG.REMOVE_MEMO_REMINDER,
					memoId: memo.id
				});
				log.info(`🗑️ Removed from SW: "${memo.title}"`);
			}
		} catch (e) {
			log.error('Failed to update reminder in SW', e);
		}
	}

	// Service Worker에서 알림 제거
	async function removeReminderFromServiceWorker(memoId: string) {
		const sw = await awaitActivatedServiceWorker();
		if (!sw) return;

		try {
			sw.postMessage({
				type: SW_MSG.REMOVE_MEMO_REMINDER,
				memoId
			});
			log.info(`🗑️ Removed from SW: ${memoId}`);
		} catch (e) {
			log.error('Failed to remove reminder from SW', e);
		}
	}

	// Service Worker의 스케줄 상태 조회 (디버그용)
	async function getServiceWorkerScheduleStatus(): Promise<{
		reminders: unknown[];
		intervalRunning: boolean;
	} | null> {
		const sw = await awaitActivatedServiceWorker();
		if (!sw) return null;

		try {
			return new Promise((resolve) => {
				const messageChannel = new MessageChannel();
				messageChannel.port1.onmessage = (event) => {
					resolve(event.data);
				};

				sw.postMessage({ type: SW_MSG.GET_SCHEDULED_REMINDERS }, [messageChannel.port2]);

				// 타임아웃
				setTimeout(() => resolve(null), 3000);
			});
		} catch (e) {
			log.error('Failed to get SW schedule status', e);
			return null;
		}
	}

	// 로그아웃 시 알림 관련 전체 정리
	async function cleanup() {
		// 1. 백그라운드 체크 인터벌 중지
		stopBackgroundCheck();

		// 2. Service Worker에 등록된 리마인더 모두 해제
		if (typeof navigator !== 'undefined') {
			try {
				const sw = await awaitActivatedServiceWorker();
				if (sw) {
					sw.postMessage({
						type: SW_MSG.REGISTER_MEMO_REMINDERS,
						reminders: []
					});
				}
			} catch (e) {
				log.error('Failed to clear SW reminders on logout', e);
			}
		}

		// 3. 스누즈 상태 초기화
		snoozedReminders = [];
		saveSnoozed();

		// 4. 알림 발송 기록 초기화
		lastNotifiedMap = {};
		saveLastNotified();

		// 5. 초기화 플래그 리셋
		initialized = false;
	}

	return {
		get permission() {
			return permission;
		},
		get initialized() {
			return initialized;
		},
		get snoozedReminders() {
			return snoozedReminders;
		},
		init,
		cleanup,
		requestPermission,
		showNotification,
		getTodayReminders,
		getUpcomingReminders,
		getPastReminders,
		startBackgroundCheck,
		stopBackgroundCheck,
		checkAndTriggerReminders,
		snooze,
		cancelSnooze,
		getSnoozedUntil,
		// SW 관련
		registerRemindersToServiceWorker,
		syncRemindersToServiceWorker,
		updateReminderInServiceWorker,
		removeReminderFromServiceWorker,
		getServiceWorkerScheduleStatus,
		get activeReminderSyncKey() {
			return activeReminderSyncKey;
		}
	};
}

export const notificationStore = createNotificationStore();
