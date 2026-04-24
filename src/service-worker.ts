/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `memo-alarm-${version}`;

const ASSETS = [...build, ...files];

// 메모 알림 스케줄 저장소 (Service Worker 메모리)
interface ScheduledReminder {
	memoId: string;
	reminderId?: string; // 다중 알림 지원용
	title: string;
	body: string;
	time: string; // HH:MM
	type: 'once' | 'repeat';
	days?: number[]; // 0-6 (일-토)
	date?: string; // YYYY-MM-DD
	url?: string;
	autoOpen?: boolean;
	lastNotified?: string; // YYYY-MM-DD-HH:MM
}

// Todo 알림 스케줄 (Phase 2)
interface TodoScheduledNotification {
	memoId: string;
	notificationId: string;
	title: string;
	body: string;
	type: 'todo-remind' | 'todo-alert' | 'todo-overdue';
	priority: 'normal' | 'high';
	time?: string; // HH:MM for daily remind
	dateTime?: string; // ISO timestamp for one-time alerts
	requireInteraction: boolean;
	url: string;
	dueDate?: string;
	dueTime?: string;
	lastNotified?: string; // YYYY-MM-DD-HH:MM
}

let scheduledReminders: ScheduledReminder[] = [];
let todoNotifications: TodoScheduledNotification[] = [];
let reminderCheckInterval: ReturnType<typeof setInterval> | null = null;

// 시간/날짜 유틸리티 (Service Worker 스코프에서는 $lib import 불가)
function getCurrentTimeHHMM(date: Date = new Date()): string {
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getTodayDateISO(date: Date = new Date()): string {
	return date.toISOString().split('T')[0];
}

// NOTE: duplicated from src/lib/utils/notificationMerge.ts — SW scope
function buildMergedTitle(count: number): string {
	return `${count}개의 메모 알림`;
}
function buildMergedBody(titles: string[], maxItems = 4): string {
	if (titles.length === 0) return '';
	const shown = titles.slice(0, maxItems).map((t) => `• ${t}`).join('\n');
	const rest = titles.length - maxItems;
	return rest > 0 ? `${shown}\n외 ${rest}건` : shown;
}
// NOTE: duplicated label for todo — SW scope
function buildMergedTodoTitle(count: number): string {
	return `${count}개의 할일 알림`;
}

// 메인 스레드로 로그 전달 함수
function swLog(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
	const logMsg = `[SW] ${message}`;
	if (level === 'error') {
		console.error(logMsg, data ?? '');
	} else if (level === 'warn') {
		console.warn(logMsg, data ?? '');
	} else {
		console.log(logMsg, data ?? '');
	}

	// 메인 스레드의 모든 클라이언트에 로그 전달
	sw.clients.matchAll().then((clients) => {
		clients.forEach((client) => {
			client.postMessage({
				type: 'SW_LOG',
				level,
				source: 'SW',
				message,
				data,
				timestamp: Date.now()
			});
		});
	});
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => {
			sw.skipWaiting();
		})
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE_NAME) {
					await caches.delete(key);
				}
			}
			sw.clients.claim();
		})
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// 같은 origin만 캐시
	if (url.origin !== location.origin) return;

	// API 요청은 캐시하지 않음
	if (url.pathname.startsWith('/api')) return;

	event.respondWith(
		caches.open(CACHE_NAME).then(async (cache) => {
			const cachedResponse = await cache.match(event.request);

			if (cachedResponse) {
				return cachedResponse;
			}

			const response = await fetch(event.request);

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		})
	);
});

// Push 이벤트 수신 (VAPID Web Push)
sw.addEventListener('push', (event) => {
	const data = event.data?.json() ?? {
		title: '메모 알람',
		body: '알림이 있습니다'
	};

	event.waitUntil(
		sw.registration.showNotification(data.title, {
			body: data.body,
			icon: '/favicon.png',
			badge: '/favicon.png',
			tag: data.tag || 'memo-reminder',
			data: { url: data.url || '/', memoId: data.memoId },
			vibrate: [200, 100, 200],
			requireInteraction: true
		})
	);
});

// 알림 발송 기록을 메인 앱에 전달
function sendNotificationRecord(reminder: ScheduledReminder, status: 'success' | 'failed', errorMessage?: string) {
	sw.clients.matchAll().then((clients) => {
		clients.forEach((client) => {
			client.postMessage({
				type: 'NOTIFICATION_SENT',
				memoId: reminder.memoId,
				memoTitle: reminder.title,
				reminderId: reminder.reminderId || '',
				reminderType: 'default',
				channel: 'sw-push',
				status,
				errorMessage: errorMessage || null,
				sentAt: new Date().toISOString()
			});
		});
	});
}

// 단일 알림 표시
function showSingleNotification(reminder: ScheduledReminder) {
	try {
		sw.registration.showNotification(reminder.title, {
			body: reminder.body || '알림이 도착했습니다',
			icon: '/favicon.png',
			badge: '/favicon.png',
			tag: `memo-${reminder.memoId}`,
			data: {
				memoId: reminder.memoId,
				url: reminder.url || '/',
				type: 'single'
			},
			vibrate: [200, 100, 200],
			requireInteraction: true
		});
		sendNotificationRecord(reminder, 'success');
	} catch (e) {
		const errorMsg = e instanceof Error ? e.message : String(e);
		sendNotificationRecord(reminder, 'failed', errorMsg);
	}
}

// 병합 알림 표시 (같은 시간에 여러 알림이 있을 때)
function showMergedNotification(reminders: ScheduledReminder[], time: string) {
	const memoIds = reminders.map(r => r.memoId);

	try {
		sw.registration.showNotification(buildMergedTitle(reminders.length), {
			body: buildMergedBody(reminders.map(r => r.title)),
			icon: '/favicon.png',
			badge: '/favicon.png',
			tag: `memo-batch-${time}`,
			data: {
				memoIds,
				url: '/',
				type: 'merged',
				time
			},
			vibrate: [200, 100, 200],
			requireInteraction: true
		});
		reminders.forEach((r) => sendNotificationRecord(r, 'success'));
	} catch (e) {
		const errorMsg = e instanceof Error ? e.message : String(e);
		reminders.forEach((r) => sendNotificationRecord(r, 'failed', errorMsg));
	}
}

function showMergedTodoNotification(todos: TodoScheduledNotification[], time: string) {
	const memoIds = todos.map(t => t.memoId);

	try {
		sw.registration.showNotification(buildMergedTodoTitle(todos.length), {
			body: buildMergedBody(todos.map(t => t.title)),
			icon: '/favicon.png',
			badge: '/favicon.png',
			tag: `todo-batch-${time}`,
			data: {
				type: 'todo-merged',
				time,
				memoIds
			},
			vibrate: [200, 100, 200],
			requireInteraction: true
		});

		sw.clients.matchAll().then((clients) => {
			const sentAt = new Date().toISOString();
			todos.forEach((todo) => {
				clients.forEach((client) => {
					client.postMessage({
						type: 'TODO_NOTIFICATION_SENT',
						memoId: todo.memoId,
						notificationId: todo.notificationId,
						notificationType: todo.type,
						status: 'success',
						errorMessage: null,
						sentAt
					});
				});
			});
		});
	} catch (e) {
		const errorMsg = e instanceof Error ? e.message : String(e);
		swLog('error', 'Failed to show merged todo notification', e);
		sw.clients.matchAll().then((clients) => {
			const sentAt = new Date().toISOString();
			todos.forEach((todo) => {
				clients.forEach((client) => {
					client.postMessage({
						type: 'TODO_NOTIFICATION_SENT',
						memoId: todo.memoId,
						notificationId: todo.notificationId,
						notificationType: todo.type,
						status: 'failed',
						errorMessage: errorMsg,
						sentAt
					});
				});
			});
		});
	}
}

// Todo 알림 체크 함수 (Phase 2)
function checkTodoNotifications() {
	const now = new Date();
	const currentTime = getCurrentTimeHHMM(now);
	const todayDate = getTodayDateISO(now);
	const notifyKey = `${todayDate}-${currentTime}`;

	swLog('info', `📋 Todo Notifications: ${todoNotifications.length}`);

	const todosToNotify: TodoScheduledNotification[] = [];

	todoNotifications.forEach((notif) => {
		// 이미 발송됨
		if (notif.lastNotified === notifyKey) {
			return;
		}

		let shouldNotify = false;

		// 매일 반복 (상기)
		if (notif.time) {
			shouldNotify = notif.time === currentTime;
		}
		// 일회성 (알람)
		else if (notif.dateTime) {
			const alertTime = new Date(notif.dateTime);
			const alertTimeHHMM = getCurrentTimeHHMM(alertTime);
			const alertDate = getTodayDateISO(alertTime);
			shouldNotify = alertDate === todayDate && alertTimeHHMM === currentTime;
		}

		if (shouldNotify) {
			swLog('info', `🔔 Todo ${notif.type}: "${notif.title}"`);
			todosToNotify.push(notif);
			notif.lastNotified = notifyKey;

			// 일회성 알람은 발송 후 제거
			if (notif.dateTime) {
				todoNotifications = todoNotifications.filter((n) => n.notificationId !== notif.notificationId);
			}
		}
	});

	if (todosToNotify.length === 0) return;

	if (todosToNotify.length >= 2) {
		showMergedTodoNotification(todosToNotify, currentTime);
		return;
	}

	const notif = todosToNotify[0];
	try {
		sw.registration.showNotification(notif.title, {
			body: notif.body,
			icon: '/favicon.png',
			badge: '/favicon.png',
			tag: notif.notificationId,
			data: {
				memoId: notif.memoId,
				url: notif.url,
				type: notif.type
			},
			vibrate: notif.type === 'todo-alert' ? [200, 100, 200, 100, 200] : [200, 100, 200],
			requireInteraction: notif.requireInteraction
		});

		// 메인 스레드에 기록 전달
		sw.clients.matchAll().then((clients) => {
			clients.forEach((client) => {
				client.postMessage({
					type: 'TODO_NOTIFICATION_SENT',
					memoId: notif.memoId,
					notificationId: notif.notificationId,
					notificationType: notif.type,
					status: 'success',
					errorMessage: null,
					sentAt: new Date().toISOString()
				});
			});
		});
	} catch (e) {
		const errorMsg = e instanceof Error ? e.message : String(e);
		swLog('error', `Failed to show todo notification: ${notif.title}`, e);
		sw.clients.matchAll().then((clients) => {
			clients.forEach((client) => {
				client.postMessage({
					type: 'TODO_NOTIFICATION_SENT',
					memoId: notif.memoId,
					notificationId: notif.notificationId,
					notificationType: notif.type,
					status: 'failed',
					errorMessage: errorMsg,
					sentAt: new Date().toISOString()
				});
			});
		});
	}
}

// 메모 알림 체크 함수
function checkScheduledReminders() {
	const now = new Date();
	const currentTime = getCurrentTimeHHMM(now);
	const today = now.getDay();
	const todayDate = getTodayDateISO(now);
	const notifyKey = `${todayDate}-${currentTime}`;

	swLog('info', `🕐 Checking at ${currentTime} (${todayDate}, day=${today})`);
	swLog('info', `📋 Reminders: ${scheduledReminders.length}`);

	// 발송할 알림 수집
	const remindersToNotify: ScheduledReminder[] = [];

	scheduledReminders.forEach((reminder) => {
		// 시간 체크
		if (reminder.time !== currentTime) {
			return;
		}

		swLog('info', `⏱️ Time match: "${reminder.title}"`);

		// 이미 발송된 알림인지 체크
		if (reminder.lastNotified === notifyKey) {
			swLog('info', `⏩ Already notified: ${notifyKey}`);
			return;
		}

		// 날짜/요일 체크
		if (reminder.type === 'once') {
			if (reminder.date !== todayDate) {
				swLog('info', `❌ Date mismatch: ${reminder.date} != ${todayDate}`);
				return;
			}
		} else {
			if (!reminder.days?.includes(today)) {
				swLog('info', `❌ Day mismatch: ${JSON.stringify(reminder.days)} !includes ${today}`);
				return;
			}
		}

		// 발송 목록에 추가
		remindersToNotify.push(reminder);

		// 발송 기록
		reminder.lastNotified = notifyKey;

		// 일회성 알림은 제거
		if (reminder.type === 'once') {
			swLog('info', `🗑️ Removing one-time: "${reminder.title}"`);
			scheduledReminders = scheduledReminders.filter((r) => {
				if (r.reminderId && reminder.reminderId) {
					return r.reminderId !== reminder.reminderId;
				}
				return r.memoId !== reminder.memoId;
			});
		}
	});

	// 알림 발송 (병합 처리)
	if (remindersToNotify.length === 0) {
		return;
	}

	if (remindersToNotify.length === 1) {
		// 단일 알림
		swLog('info', `🔔 TRIGGERING single: "${remindersToNotify[0].title}"`);
		showSingleNotification(remindersToNotify[0]);
	} else {
		// 병합 알림
		swLog('info', `🔔 TRIGGERING merged: ${remindersToNotify.length} reminders`);
		showMergedNotification(remindersToNotify, currentTime);
	}

	// Todo 알림도 체크 (Phase 2)
	checkTodoNotifications();
}

// 알림 체크 인터벌 시작
function startReminderCheck() {
	if (reminderCheckInterval) {
		swLog('info', 'Reminder check already running');
		return;
	}

	swLog('info', '🚀 Starting reminder check (60s interval)');

	// 매분 체크
	reminderCheckInterval = setInterval(() => {
		checkScheduledReminders();
	}, 60000);

	// 즉시 체크
	checkScheduledReminders();
}

// 메시지 수신 (캐시 업데이트 및 테스트용)
sw.addEventListener('message', (event) => {
	if (event.data.type === 'SKIP_WAITING') {
		swLog('info', 'SKIP_WAITING received');
		sw.skipWaiting();
	}

	// 테스트 알림 (즉시)
	if (event.data.type === 'TEST_NOTIFICATION') {
		swLog('info', 'TEST_NOTIFICATION received');
		sw.registration.showNotification(event.data.title || '테스트 알림', {
			body: event.data.body || '서비스 워커에서 보낸 테스트 알림입니다.',
			icon: '/favicon.png',
			badge: '/favicon.png',
			tag: 'test-notification',
			data: { url: '/', isTest: true },
			vibrate: [200, 100, 200],
			requireInteraction: true
		});
	}

	// 지연 알림 테스트 (백그라운드 테스트용)
	if (event.data.type === 'DELAYED_NOTIFICATION') {
		const delay = event.data.delay || 5000;
		swLog('info', `DELAYED_NOTIFICATION: ${delay}ms`);

		setTimeout(() => {
			swLog('info', `DELAYED firing after ${delay}ms`);
			sw.registration.showNotification(event.data.title || '백그라운드 알림 테스트', {
				body: event.data.body || `${delay / 1000}초 후 알림이 도착했습니다! 앱이 백그라운드에 있어도 작동합니다.`,
				icon: '/favicon.png',
				badge: '/favicon.png',
				tag: 'delayed-test-notification',
				data: { url: '/', isTest: true, delayed: true },
				vibrate: [200, 100, 200, 100, 200],
				requireInteraction: true
			});
		}, delay);
	}

	// 메모 알림 스케줄 등록
	if (event.data.type === 'REGISTER_MEMO_REMINDERS') {
		swLog('info', '📝 REGISTER_MEMO_REMINDERS received');
		const reminders = event.data.reminders as ScheduledReminder[];
		scheduledReminders = reminders;
		swLog('info', `Registered ${reminders.length} reminders`);

		// 체크 인터벌 시작
		startReminderCheck();
	}

	// 단일 알림 추가/갱신
	if (event.data.type === 'UPDATE_MEMO_REMINDER') {
		swLog('info', '📝 UPDATE_MEMO_REMINDER');
		const reminder = event.data.reminder as ScheduledReminder;

		// 기존 알림 제거 후 추가
		scheduledReminders = scheduledReminders.filter((r) => r.memoId !== reminder.memoId);

		if (reminder.time) {
			scheduledReminders.push(reminder);
			swLog('info', `Updated: "${reminder.title}" at ${reminder.time}`);
		} else {
			swLog('info', `Removed: memoId=${reminder.memoId}`);
		}
	}

	// 알림 제거
	if (event.data.type === 'REMOVE_MEMO_REMINDER') {
		swLog('info', `🗑️ REMOVE: ${event.data.memoId}`);
		scheduledReminders = scheduledReminders.filter((r) => r.memoId !== event.data.memoId);
	}

	// 스케줄 상태 조회 (디버그용)
	if (event.data.type === 'GET_SCHEDULED_REMINDERS') {
		swLog('info', '📊 GET_SCHEDULED_REMINDERS');
		event.ports[0]?.postMessage({
			reminders: scheduledReminders,
			intervalRunning: !!reminderCheckInterval
		});
	}

	// Todo 알림 등록 (Phase 2)
	if (event.data.type === 'REGISTER_TODO_NOTIFICATIONS') {
		swLog('info', '📝 REGISTER_TODO_NOTIFICATIONS received');
		const notifications = event.data.notifications as TodoScheduledNotification[];

		// 해당 todo의 기존 알림 제거
		if (notifications.length > 0) {
			const todoId = notifications[0].memoId;
			todoNotifications = todoNotifications.filter((n) => n.memoId !== todoId);
		}

		// 새 알림 추가
		todoNotifications.push(...notifications);
		swLog('info', `Registered ${notifications.length} todo notifications. Total: ${todoNotifications.length}`);

		// 체크 인터벌 시작
		startReminderCheck();
	}

	// Todo 알림 제거 (Phase 2)
	if (event.data.type === 'REMOVE_TODO_NOTIFICATIONS') {
		swLog('info', `🗑️ REMOVE_TODO_NOTIFICATIONS: ${event.data.todoId}`);
		todoNotifications = todoNotifications.filter((n) => n.memoId !== event.data.todoId);
	}
});

// 알림 클릭
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const data = event.notification.data;

	// 앱 내 네비게이션 URL 결정 (항상 same-origin)
	let appUrl: string;
	if (data?.type === 'todo-merged') {
		appUrl = '/todos';
		swLog('info', '📱 Merged todo notification clicked, navigating to todos');
	} else if (data?.type === 'merged') {
		appUrl = '/';
		swLog('info', `📱 Merged notification clicked, navigating to home`);
	} else if (typeof data?.type === 'string' && data.type.startsWith('todo-')) {
		// todo-remind | todo-alert | todo-overdue → /todos 리스트 진입 (deep-link 미지원)
		appUrl = '/todos';
		swLog('info', `📱 Single todo notification clicked: type=${data.type}, memoId=${data.memoId}, navigating to todos`);
	} else if (data?.memoId) {
		appUrl = `/?memo=${data.memoId}`;
		swLog('info', `📱 Single notification clicked: memoId=${data.memoId}`);
	} else {
		appUrl = '/';
		swLog('info', `📱 Notification clicked, no memoId, navigating to home`);
	}

	// 외부 URL이 있으면 별도로 열기 위해 저장
	const externalUrl = data?.url && data.url !== '/' && data.url.startsWith('http') ? data.url : null;

	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// 이미 열린 창이 있으면 포커스 후 네비게이트
			for (const client of clientList) {
				if (client.url.includes(sw.location.origin) && 'focus' in client) {
					return (client as WindowClient).focus().then((focusedClient) => {
						if (externalUrl) {
							// 외부 URL: 새 탭으로 열기
							sw.clients.openWindow(externalUrl);
							// autoOpen 트리거 메시지 전달 (incrementOpenCount 호출용)
							if (data?.memoId) {
								focusedClient.postMessage({
									type: 'AUTO_OPEN_TRIGGERED',
									memoId: data.memoId
								});
							}
						}
						// 앱 내 URL: 네비게이트
						return focusedClient.navigate(appUrl).catch(() => sw.clients.openWindow(appUrl));
					});
				}
			}
			// 열린 창 없으면 새 창 열기
			if (externalUrl) {
				return sw.clients.openWindow(externalUrl);
			}
			return sw.clients.openWindow(appUrl);
		})
	);
});
