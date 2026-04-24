import type { Memo, TodoRemindEntry, TodoAlertEntry } from '$lib/types/memo';
import { isNative } from './capacitor';
import { SW_MSG } from '$lib/constants/swMessages';

/**
 * Todo 알림 스케줄링 유틸리티
 * Phase 2: 상기(Remind) + 알람(Alert) 발송
 */

// Service Worker용 Todo 알림 인터페이스
export interface TodoScheduledNotification {
	memoId: string;
	notificationId: string; // unique ID for this specific notification
	title: string;
	body: string;
	type: 'todo-remind' | 'todo-alert' | 'todo-overdue';
	priority: 'normal' | 'high'; // high for alerts
	time?: string; // HH:MM for daily remind
	dateTime?: string; // ISO timestamp for one-time alerts
	requireInteraction: boolean;
	url: string;
	dueDate?: string;
	dueTime?: string;
	lastNotified?: string; // YYYY-MM-DD-HH:MM
}

/**
 * Todo의 모든 알림을 계산하여 Service Worker에 등록
 */
export async function scheduleTodoNotifications(todo: Memo): Promise<void> {
	if (todo.memoType !== 'todo' || todo.todoStatus !== 'pending') {
		await cancelTodoNotifications(todo.id);
		return;
	}

	// Phase 3: 반복 할일인 경우 활성 인스턴스가 없으면 스케줄링하지 않음
	if (todo.recurrence && todo.todoInstances) {
		const activeInstance = todo.todoInstances.find(i => i.status === 'pending');
		if (!activeInstance) {
			await cancelTodoNotifications(todo.id);
			return;
		}
	}

	// 전역 설정 가져오기
	const { settingsStore } = await import('$lib/stores/settings.svelte');
	const globalRemindTime = settingsStore.settings.todoDefaults.remind.time;
	const globalAutoAlertMinutes = settingsStore.settings.todoDefaults.autoAlert.minutesBefore;

	const notifications: TodoScheduledNotification[] = [];

	// 1. 상기 알림 (Remind) - 매일 특정 시각
	const remindNotifications = buildRemindNotifications(todo, globalRemindTime);
	notifications.push(...remindNotifications);

	// 2. 알람 (Alert) - 일회성 또는 기한 전
	const alertNotifications = buildAlertNotifications(todo, globalAutoAlertMinutes);
	notifications.push(...alertNotifications);

	// Service Worker에 등록
	await registerNotificationsInServiceWorker(notifications);

	// Native (Capacitor)에도 등록
	if (await isNative()) {
		await scheduleTodoNotificationsNative(todo, notifications);
	}
}

/**
 * Phase 3: 반복 할일의 유효 기한 날짜 계산
 * - 반복 할일: 활성 인스턴스의 scheduledDate
 * - 단발성 할일: dueDate
 */
function getEffectiveDueDate(todo: Memo): string | undefined {
	// Phase 3: 반복 할일인 경우 활성 인스턴스의 scheduledDate 사용
	if (todo.recurrence && todo.todoInstances) {
		const activeInstance = todo.todoInstances.find(i => i.status === 'pending');
		if (activeInstance) {
			return activeInstance.scheduledDate;
		}
	}
	// 단발성 할일은 원래 dueDate 사용
	return todo.dueDate;
}

/**
 * 상기 알림 생성 (매일 특정 시각)
 */
function buildRemindNotifications(todo: Memo, globalRemindTime: string): TodoScheduledNotification[] {
	const notifications: TodoScheduledNotification[] = [];
	const timing = todo.todoTiming;

	if (!timing) return notifications;

	// Phase 3: 유효 기한 날짜 계산 (반복 할일은 활성 인스턴스 기준)
	const effectiveDueDate = getEffectiveDueDate(todo);

	// useGlobalRemind=true인 경우 - 전역 설정 시각 사용
	if (timing.useGlobalRemind) {
		notifications.push({
			memoId: todo.id,
			notificationId: `${todo.id}-remind-global`,
			title: '📋 할일 상기',
			body: buildRemindBody(todo),
			type: 'todo-remind',
			priority: 'normal',
			time: globalRemindTime, // HH:MM
			requireInteraction: false,
			url: `/todos?id=${todo.id}`,
			dueDate: effectiveDueDate,
			dueTime: todo.dueTime
		});
	}
	// 개별 remindTimes 처리
	else if (timing.remindTimes.length > 0) {
		timing.remindTimes.forEach((remind, index) => {
			if (remind.type === 'time' && remind.time) {
				// 매일 특정 시각
				notifications.push({
					memoId: todo.id,
					notificationId: `${todo.id}-remind-${index}`,
					title: '📋 할일 상기',
					body: buildRemindBody(todo),
					type: 'todo-remind',
					priority: 'normal',
					time: remind.time, // HH:MM
					requireInteraction: false,
					url: `/todos?id=${todo.id}`,
					dueDate: effectiveDueDate,
					dueTime: todo.dueTime
				});
			} else if (remind.type === 'before_due' && remind.minutesBefore && effectiveDueDate) {
				// 기한 N분 전
				const alertTime = calculateBeforeDueTime(effectiveDueDate, todo.dueTime, String(remind.minutesBefore));
				if (alertTime && alertTime > new Date()) {
					notifications.push({
						memoId: todo.id,
						notificationId: `${todo.id}-remind-before-${index}`,
						title: '📋 할일 상기 (기한 임박)',
						body: buildRemindBody(todo),
						type: 'todo-remind',
						priority: 'normal',
						dateTime: alertTime.toISOString(),
						requireInteraction: false,
						url: `/todos?id=${todo.id}`,
						dueDate: effectiveDueDate,
						dueTime: todo.dueTime
					});
				}
			}
		});
	}

	return notifications;
}

/**
 * 알람 알림 생성 (일회성, 기한 전)
 */
function buildAlertNotifications(todo: Memo, globalAutoAlertMinutes: number): TodoScheduledNotification[] {
	const notifications: TodoScheduledNotification[] = [];
	const timing = todo.todoTiming;

	if (!timing) return notifications;

	// Phase 3: 유효 기한 날짜 계산 (반복 할일은 활성 인스턴스 기준)
	const effectiveDueDate = getEffectiveDueDate(todo);

	// 1. 자동 알람 (autoAlertBefore) - 전역 또는 개별
	const autoAlertMinutes = timing.useGlobalAutoAlert ? globalAutoAlertMinutes : timing.autoAlertBefore;

	if (autoAlertMinutes && effectiveDueDate) {
		const alertTime = calculateBeforeDueTime(
			effectiveDueDate,
			todo.dueTime,
			String(autoAlertMinutes)
		);

		if (alertTime && alertTime > new Date()) {
			notifications.push({
				memoId: todo.id,
				notificationId: `${todo.id}-auto-alert`,
				title: '🔔 할일 알람',
				body: buildAlertBody(todo, autoAlertMinutes),
				type: 'todo-alert',
				priority: 'high',
				dateTime: alertTime.toISOString(),
				requireInteraction: true,
				url: `/todos?id=${todo.id}`,
				dueDate: effectiveDueDate,
				dueTime: todo.dueTime
			});
		}
	}

	// 2. 수동 알람들 (alertTimes)
	timing.alertTimes.forEach((alert, index) => {
		const alertDateTime = parseAlertDateTime(alert, effectiveDueDate);
		if (alertDateTime && alertDateTime > new Date()) {
			notifications.push({
				memoId: todo.id,
				notificationId: `${todo.id}-alert-${index}`,
				title: '🔔 할일 알람',
				body: buildAlertBody(todo),
				type: 'todo-alert',
				priority: 'high',
				dateTime: alertDateTime.toISOString(),
				requireInteraction: true,
				url: `/todos?id=${todo.id}`,
				dueDate: effectiveDueDate,
				dueTime: todo.dueTime
			});
		}
	});

	return notifications;
}

/**
 * 기한 N분 전 시각 계산
 */
function calculateBeforeDueTime(
	dueDate: string,
	dueTime: string | undefined,
	minutesBeforeStr: string
): Date | null {
	try {
		const minutesBefore = parseInt(minutesBeforeStr, 10);
		if (isNaN(minutesBefore)) return null;

		const dueDateTime = new Date(dueDate);
		if (dueTime) {
			const [hours, minutes] = dueTime.split(':').map(Number);
			dueDateTime.setHours(hours, minutes, 0, 0);
		} else {
			dueDateTime.setHours(23, 59, 0, 0);
		}

		const alertTime = new Date(dueDateTime.getTime() - minutesBefore * 60000);
		return alertTime;
	} catch {
		return null;
	}
}

/**
 * TodoAlertEntry를 실제 DateTime으로 변환
 */
function parseAlertDateTime(alert: TodoAlertEntry, dueDate?: string): Date | null {
	try {
		if (alert.type === 'datetime' && alert.date && alert.time) {
			return new Date(`${alert.date}T${alert.time}:00`);
		} else if (alert.type === 'before_due' && alert.minutesBefore && dueDate) {
			return calculateBeforeDueTime(dueDate, undefined, String(alert.minutesBefore));
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * 상기 알림 본문 생성
 */
function buildRemindBody(todo: Memo): string {
	const parts: string[] = [todo.title];

	if (todo.dueDate) {
		const dueDate = new Date(todo.dueDate);
		const formatted = `${dueDate.getMonth() + 1}/${dueDate.getDate()}`;
		if (todo.dueTime) {
			parts.push(`기한: ${formatted} ${todo.dueTime}`);
		} else {
			parts.push(`기한: ${formatted}`);
		}
	} else {
		parts.push('(기한 없음)');
	}

	return parts.join(' | ');
}

/**
 * 알람 알림 본문 생성
 */
function buildAlertBody(todo: Memo, minutesBefore?: number): string {
	const parts: string[] = [todo.title];

	if (minutesBefore && todo.dueDate) {
		const hours = Math.floor(minutesBefore / 60);
		const minutes = minutesBefore % 60;
		if (hours > 0) {
			parts.push(`${hours}시간 ${minutes}분 후 기한`);
		} else {
			parts.push(`${minutes}분 후 기한`);
		}
	} else if (todo.dueDate) {
		parts.push('지금 해야 해요!');
	}

	return parts.join(' | ');
}

/**
 * Service Worker에 알림 등록
 */
async function registerNotificationsInServiceWorker(
	notifications: TodoScheduledNotification[]
): Promise<void> {
	if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
		return;
	}

	try {
		navigator.serviceWorker.controller.postMessage({
			type: SW_MSG.REGISTER_TODO_NOTIFICATIONS,
			notifications
		});
	} catch (e) {
		console.error('[TodoNotifications] Failed to register in SW:', e);
	}
}

/**
 * Service Worker에서 특정 Todo의 모든 알림 제거
 */
export async function cancelTodoNotifications(todoId: string): Promise<void> {
	if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
		return;
	}

	try {
		navigator.serviceWorker.controller.postMessage({
			type: SW_MSG.REMOVE_TODO_NOTIFICATIONS,
			todoId
		});
	} catch (e) {
		console.error('[TodoNotifications] Failed to cancel in SW:', e);
	}

	// Native에서도 취소
	if (await isNative()) {
		await cancelTodoNotificationsNative(todoId);
	}
}

/**
 * Capacitor Native 알림 스케줄링
 */
async function scheduleTodoNotificationsNative(
	todo: Memo,
	notifications: TodoScheduledNotification[]
): Promise<void> {
	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');

		// 기존 알림 취소
		await cancelTodoNotificationsNative(todo.id);

		// 새 알림 등록
		const nativeNotifications = notifications.map((notif, index) => {
			let scheduleDate: Date;

			if (notif.dateTime) {
				// 일회성 알람
				scheduleDate = new Date(notif.dateTime);
			} else if (notif.time) {
				// 매일 반복 상기
				const [hours, minutes] = notif.time.split(':').map(Number);
				scheduleDate = new Date();
				scheduleDate.setHours(hours, minutes, 0, 0);
				if (scheduleDate < new Date()) {
					scheduleDate.setDate(scheduleDate.getDate() + 1);
				}
			} else {
				return null;
			}

			return {
				id: generateTodoNotificationId(todo.id, index),
				title: notif.title,
				body: notif.body,
				schedule: notif.dateTime
					? { at: scheduleDate }
					: { at: scheduleDate, repeats: true, every: 'day' as const },
				extra: {
					memoId: todo.id,
					notificationId: notif.notificationId,
					type: notif.type,
					url: notif.url
				},
				sound: notif.type === 'todo-alert' ? 'default' : undefined,
				channelId: notif.type === 'todo-alert' ? 'todo-alerts' : 'todo-reminders'
			};
		}).filter((n): n is NonNullable<typeof n> => n !== null);

		if (nativeNotifications.length > 0) {
			await LocalNotifications.schedule({ notifications: nativeNotifications });
		}
	} catch (e) {
		console.error('[TodoNotifications] Native scheduling failed:', e);
	}
}

/**
 * Capacitor Native 알림 취소
 */
async function cancelTodoNotificationsNative(todoId: string): Promise<void> {
	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		const pending = await LocalNotifications.getPending();
		const toCancel = pending.notifications
			.filter((n) => n.extra?.memoId === todoId)
			.map((n) => ({ id: n.id }));

		if (toCancel.length > 0) {
			await LocalNotifications.cancel({ notifications: toCancel });
		}
	} catch (e) {
		console.error('[TodoNotifications] Native cancel failed:', e);
	}
}

/**
 * Todo 알림 ID 생성 (일관된 숫자 ID)
 */
function generateTodoNotificationId(todoId: string, index: number): number {
	let hash = 0;
	const str = `todo-${todoId}-${index}`;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash);
}

/**
 * 전역 상기 시각 변경 시 모든 Todo 재스케줄
 */
export async function rescheduleAllTodosForGlobalRemind(
	todos: Memo[],
	newRemindTime: string
): Promise<void> {
	const todosWithGlobalRemind = todos.filter(
		(todo) =>
			todo.memoType === 'todo' &&
			todo.todoStatus === 'pending' &&
			todo.todoTiming?.useGlobalRemind
	);

	for (const todo of todosWithGlobalRemind) {
		await scheduleTodoNotifications(todo);
	}
}

/**
 * 전역 자동알람 시각 변경 시 모든 Todo 재스케줄
 */
export async function rescheduleAllTodosForGlobalAutoAlert(
	todos: Memo[],
	newMinutesBefore: number
): Promise<void> {
	const todosWithGlobalAutoAlert = todos.filter(
		(todo) =>
			todo.memoType === 'todo' &&
			todo.todoStatus === 'pending' &&
			todo.todoTiming?.useGlobalAutoAlert
	);

	for (const todo of todosWithGlobalAutoAlert) {
		await scheduleTodoNotifications(todo);
	}
}
