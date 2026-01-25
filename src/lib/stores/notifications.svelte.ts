import type { Memo } from '$lib/types/memo';
import { memosStore } from './memos.svelte';
import { createLogger, devLogStore } from './devLogs.svelte';

const STORAGE_KEY = 'memo-alarm:last-notifications';
const SNOOZE_KEY = 'memo-alarm:snoozed-reminders';

export type SnoozeMinutes = 5 | 10 | 30 | 60;

interface SnoozedReminder {
	memoId: string;
	snoozeUntil: number; // timestamp
}

// 개발자 모드 로그
const log = createLogger('Notification');

function createNotificationStore() {
	let permission = $state<NotificationPermission>('default');
	let initialized = $state(false);
	let checkInterval: ReturnType<typeof setInterval> | null = null;
	let lastNotifiedMap = $state<Record<string, string>>({});
	let snoozedReminders = $state<SnoozedReminder[]>([]);

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

		// SW에서 보낸 로그 수신
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.addEventListener('message', (event) => {
				if (event.data.type === 'SW_LOG') {
					devLogStore.add(
						event.data.level || 'info',
						event.data.source || 'SW',
						event.data.message,
						event.data.data
					);
				}
			});
			log.info('SW message listener registered');
		}

		loadLastNotified();
		loadSnoozed();
		startBackgroundCheck();
		initialized = true;
		log.info('✅ Notification store initialized');

		// Service Worker에 알림 스케줄 등록 (약간 지연 후 - 메모 로드 대기)
		setTimeout(() => {
			log.info('📤 Registering reminders to Service Worker...');
			registerRemindersToServiceWorker();
		}, 2000);
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
		const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		const today = now.getDay();
		const todayDate = now.toISOString().split('T')[0];

		log.info(`📅 time=${currentTime}, date=${todayDate}, day=${today}`);

		// Check snoozed reminders
		if (snoozedReminders.length > 0) {
			log.info(`Snoozed: ${snoozedReminders.length}`);
		}
		snoozedReminders.forEach((snoozed) => {
			if (snoozed.snoozeUntil <= nowTimestamp) {
				const memo = memosStore.getById(snoozed.memoId);
				if (memo) {
					log.info(`⏰ Triggering snoozed: ${memo.title}`);
					showNotification(memo, true);
					if (memo.url && memo.reminder?.autoOpen) {
						window.open(memo.url, '_blank');
						memosStore.incrementOpenCount(memo.id);
					}
				}
				cancelSnooze(snoozed.memoId);
			}
		});

		// Check regular reminders
		const activeReminders = memosStore.memos.filter((m) => m.reminder?.enabled);
		log.info(`📋 Active reminders: ${activeReminders.length}`);

		memosStore.memos.forEach((memo) => {
			if (!memo.reminder?.enabled) return;

			const reminderTime = memo.reminder.time;
			if (reminderTime !== currentTime) return;

			log.info(`⏱️ Time match: "${memo.title}" (${reminderTime})`);

			// Check if already notified
			const lastNotified = lastNotifiedMap[memo.id];
			const notifyKey = `${todayDate}-${reminderTime}`;
			if (lastNotified === notifyKey) {
				log.debug(`⏩ Already notified: ${notifyKey}`);
				return;
			}

			// Check day/date conditions
			const isOnce = memo.reminder.type === 'once';
			if (isOnce) {
				if (memo.reminder.date !== todayDate) {
					log.debug(`❌ Date mismatch: ${memo.reminder.date} != ${todayDate}`);
					return;
				}
				log.info(`✅ Date match: ${todayDate}`);
			} else {
				if (!memo.reminder.days?.includes(today)) {
					log.debug(`❌ Day mismatch: ${JSON.stringify(memo.reminder.days)} !includes ${today}`);
					return;
				}
				log.info(`✅ Day match: ${today}`);
			}

			// Trigger notification
			log.info(`🔔 TRIGGERING: "${memo.title}"`);
			showNotification(memo);
			lastNotifiedMap[memo.id] = notifyKey;
			saveLastNotified();

			if (memo.url && memo.reminder.autoOpen) {
				window.open(memo.url, '_blank');
				memosStore.incrementOpenCount(memo.id);
			}

			if (isOnce) {
				log.info(`🔕 Disabling one-time: "${memo.title}"`);
				memosStore.update(memo.id, {
					reminder: { ...memo.reminder, enabled: false }
				});
			}
		});
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

		if ('serviceWorker' in navigator) {
			log.info('Using Service Worker');
			navigator.serviceWorker.ready.then((registration) => {
				log.info('SW ready, showing...');
				registration.showNotification(title, options);
			});
		} else {
			log.info('Using native Notification API');
			const notification = new Notification(title, options);
			notification.onclick = () => {
				window.focus();
				if (memo.url && memo.reminder?.autoOpen) {
					window.open(memo.url, '_blank');
					memosStore.incrementOpenCount(memo.id);
				}
				notification.close();
			};
		}
	}

	function getTodayReminders(): Memo[] {
		const today = new Date().getDay();
		const now = new Date();
		const todayDate = now.toISOString().split('T')[0];

		return memosStore.memos.filter((memo) => {
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
		const today = new Date().getDay();
		const now = new Date();
		const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

		return getTodayReminders().filter((memo) => {
			const reminderTime = memo.reminder?.time || '00:00';
			return reminderTime >= currentTime;
		});
	}

	function getPastReminders(): Memo[] {
		const now = new Date();
		const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

		return getTodayReminders().filter((memo) => {
			const reminderTime = memo.reminder?.time || '00:00';
			return reminderTime < currentTime;
		});
	}

	// Service Worker에 알림 스케줄 등록
	async function registerRemindersToServiceWorker() {
		if (!('serviceWorker' in navigator)) {
			log.warn('❌ Service Worker not supported');
			return;
		}

		try {
			const registration = await navigator.serviceWorker.ready;
			if (!registration.active) {
				log.warn('❌ No active Service Worker');
				return;
			}

			// 활성화된 알림만 필터링
			const activeReminders = memosStore.memos
				.filter((memo) => memo.reminder?.enabled)
				.map((memo) => ({
					memoId: memo.id,
					title: memo.title,
					body: memo.content || '알림이 도착했습니다',
					time: memo.reminder!.time,
					type: memo.reminder!.type,
					days: memo.reminder!.days,
					date: memo.reminder!.date,
					url: memo.url,
					autoOpen: memo.reminder!.autoOpen
				}));

			log.info(`📤 Registering ${activeReminders.length} reminders to SW`);

			registration.active.postMessage({
				type: 'REGISTER_MEMO_REMINDERS',
				reminders: activeReminders
			});

			log.info('✅ Reminders registered to SW');
		} catch (e) {
			log.error('Failed to register reminders to SW', e);
		}
	}

	// Service Worker에 단일 알림 업데이트
	async function updateReminderInServiceWorker(memo: Memo) {
		if (!('serviceWorker' in navigator)) return;

		try {
			const registration = await navigator.serviceWorker.ready;
			if (!registration.active) return;

			if (memo.reminder?.enabled) {
				registration.active.postMessage({
					type: 'UPDATE_MEMO_REMINDER',
					reminder: {
						memoId: memo.id,
						title: memo.title,
						body: memo.content || '알림이 도착했습니다',
						time: memo.reminder.time,
						type: memo.reminder.type,
						days: memo.reminder.days,
						date: memo.reminder.date,
						url: memo.url,
						autoOpen: memo.reminder.autoOpen
					}
				});
				log.info(`📤 Updated in SW: "${memo.title}"`);
			} else {
				registration.active.postMessage({
					type: 'REMOVE_MEMO_REMINDER',
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
		if (!('serviceWorker' in navigator)) return;

		try {
			const registration = await navigator.serviceWorker.ready;
			if (!registration.active) return;

			registration.active.postMessage({
				type: 'REMOVE_MEMO_REMINDER',
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
		if (!('serviceWorker' in navigator)) return null;

		try {
			const registration = await navigator.serviceWorker.ready;
			if (!registration.active) return null;

			return new Promise((resolve) => {
				const messageChannel = new MessageChannel();
				messageChannel.port1.onmessage = (event) => {
					resolve(event.data);
				};

				registration.active!.postMessage({ type: 'GET_SCHEDULED_REMINDERS' }, [
					messageChannel.port2
				]);

				// 타임아웃
				setTimeout(() => resolve(null), 3000);
			});
		} catch (e) {
			log.error('Failed to get SW schedule status', e);
			return null;
		}
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
		updateReminderInServiceWorker,
		removeReminderFromServiceWorker,
		getServiceWorkerScheduleStatus
	};
}

export const notificationStore = createNotificationStore();
