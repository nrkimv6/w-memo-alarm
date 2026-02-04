import type { Memo } from '$lib/types/memo';

/**
 * Todo Alert Manager (Phase 2)
 * 포그라운드에서 알람 시각 도달 감지 및 AlertModal 표시
 */

interface AlertTrigger {
	todoId: string;
	todo: Memo;
	triggeredAt: number;
}

let checkInterval: ReturnType<typeof setInterval> | null = null;
let onAlertTrigger: ((todo: Memo) => void) | null = null;
let lastCheckedMinute = '';
let todos: Memo[] = $state([]);

/**
 * Alert Manager 초기화
 * @param callback - 알람 발생 시 호출될 콜백 (AlertModal 표시)
 */
export function initTodoAlertManager(
	getTodos: () => Memo[],
	callback: (todo: Memo) => void
): void {
	onAlertTrigger = callback;

	// 기존 인터벌 정리
	if (checkInterval) {
		clearInterval(checkInterval);
	}

	// 매 10초마다 체크
	checkInterval = setInterval(() => {
		todos = getTodos();
		checkForAlerts();
	}, 10000);

	// 즉시 체크
	todos = getTodos();
	checkForAlerts();
}

/**
 * Alert Manager 정리
 */
export function cleanupTodoAlertManager(): void {
	if (checkInterval) {
		clearInterval(checkInterval);
		checkInterval = null;
	}
	onAlertTrigger = null;
	lastCheckedMinute = '';
}

/**
 * 알람 체크 함수
 */
function checkForAlerts(): void {
	const now = new Date();
	const currentMinute = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

	// 같은 분에는 중복 체크하지 않음
	if (currentMinute === lastCheckedMinute) {
		return;
	}

	lastCheckedMinute = currentMinute;

	// pending 상태의 todos만 체크
	const pendingTodos = todos.filter((t) => t.memoType === 'todo' && t.todoStatus === 'pending');

	for (const todo of pendingTodos) {
		if (shouldTriggerAlert(todo, now)) {
			onAlertTrigger?.(todo);
		}
	}
}

/**
 * 현재 시각에 알람을 발생시켜야 하는지 판단
 */
function shouldTriggerAlert(todo: Memo, now: Date): boolean {
	const timing = todo.todoTiming;
	if (!timing) return false;

	// 1. 자동 알람 체크 (autoAlertBefore)
	if (timing.autoAlertBefore && todo.dueDate) {
		const dueDateTime = new Date(todo.dueDate);
		if (todo.dueTime) {
			const [hours, minutes] = todo.dueTime.split(':').map(Number);
			dueDateTime.setHours(hours, minutes, 0, 0);
		} else {
			dueDateTime.setHours(23, 59, 0, 0);
		}

		const alertTime = new Date(dueDateTime.getTime() - timing.autoAlertBefore * 60000);
		if (isTimeMatch(alertTime, now)) {
			return true;
		}
	}

	// 2. 수동 알람들 체크 (alertTimes)
	for (const alert of timing.alertTimes) {
		if (alert.type === 'datetime' && alert.date && alert.time) {
			const alertTime = new Date(`${alert.date}T${alert.time}:00`);
			if (isTimeMatch(alertTime, now)) {
				return true;
			}
		} else if (alert.type === 'before_due' && alert.minutesBefore && todo.dueDate) {
			const dueDateTime = new Date(todo.dueDate);
			if (todo.dueTime) {
				const [hours, minutes] = todo.dueTime.split(':').map(Number);
				dueDateTime.setHours(hours, minutes, 0, 0);
			} else {
				dueDateTime.setHours(23, 59, 0, 0);
			}

			const alertTime = new Date(dueDateTime.getTime() - alert.minutesBefore * 60000);
			if (isTimeMatch(alertTime, now)) {
				return true;
			}
		}
	}

	return false;
}

/**
 * 두 시각이 같은 분인지 체크 (초는 무시)
 */
function isTimeMatch(target: Date, current: Date): boolean {
	return (
		target.getFullYear() === current.getFullYear() &&
		target.getMonth() === current.getMonth() &&
		target.getDate() === current.getDate() &&
		target.getHours() === current.getHours() &&
		target.getMinutes() === current.getMinutes()
	);
}
