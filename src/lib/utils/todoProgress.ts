import type { Memo } from '$lib/types/memo';

/**
 * 오늘 완료율 계산
 */
export function getTodayProgress(todos: Memo[]): { completed: number; total: number; percentage: number } {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const todayStr = today.toISOString().split('T')[0];

	const todayTodos = todos.filter(t => {
		if (t.memoType !== 'todo' || t.todoStatus === 'skipped') return false;

		// 반복 할일: 활성 인스턴스의 scheduledDate가 오늘인 경우
		if (t.recurrence && t.todoInstances) {
			const activeInstance = t.todoInstances.find(i => i.status === 'pending');
			return activeInstance && activeInstance.scheduledDate === todayStr;
		}

		// 단발성 할일: dueDate가 오늘 또는 과거인 경우
		return t.dueDate && t.dueDate <= todayStr;
	});

	const completed = todayTodos.filter(t => t.todoStatus === 'completed').length;
	const total = todayTodos.length;
	const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

	return { completed, total, percentage };
}

/**
 * 이번 주 완료율 계산
 */
export function getWeekProgress(todos: Memo[]): { completed: number; total: number; percentage: number } {
	const today = new Date();
	const startOfWeek = new Date(today);
	startOfWeek.setDate(today.getDate() - today.getDay()); // 일요일
	startOfWeek.setHours(0, 0, 0, 0);
	const startStr = startOfWeek.toISOString().split('T')[0];

	const endOfWeek = new Date(startOfWeek);
	endOfWeek.setDate(startOfWeek.getDate() + 6); // 토요일
	const endStr = endOfWeek.toISOString().split('T')[0];

	const weekTodos = todos.filter(t => {
		if (t.memoType !== 'todo' || t.todoStatus === 'skipped') return false;

		// 반복 할일: 활성 인스턴스의 scheduledDate가 이번 주인 경우
		if (t.recurrence && t.todoInstances) {
			const activeInstance = t.todoInstances.find(i => i.status === 'pending');
			if (activeInstance) {
				return activeInstance.scheduledDate >= startStr && activeInstance.scheduledDate <= endStr;
			}
		}

		// 단발성 할일: dueDate가 이번 주 범위인 경우
		return t.dueDate && t.dueDate >= startStr && t.dueDate <= endStr;
	});

	const completed = weekTodos.filter(t => t.todoStatus === 'completed').length;
	const total = weekTodos.length;
	const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

	return { completed, total, percentage };
}

/**
 * 이번 달 완료율 계산
 */
export function getMonthProgress(todos: Memo[]): { completed: number; total: number; percentage: number } {
	const today = new Date();
	const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
	const startStr = startOfMonth.toISOString().split('T')[0];

	const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
	const endStr = endOfMonth.toISOString().split('T')[0];

	const monthTodos = todos.filter(t => {
		if (t.memoType !== 'todo' || t.todoStatus === 'skipped') return false;

		// 반복 할일: 활성 인스턴스의 scheduledDate가 이번 달인 경우
		if (t.recurrence && t.todoInstances) {
			const activeInstance = t.todoInstances.find(i => i.status === 'pending');
			if (activeInstance) {
				return activeInstance.scheduledDate >= startStr && activeInstance.scheduledDate <= endStr;
			}
		}

		// 단발성 할일: dueDate가 이번 달 범위인 경우
		return t.dueDate && t.dueDate >= startStr && t.dueDate <= endStr;
	});

	const completed = monthTodos.filter(t => t.todoStatus === 'completed').length;
	const total = monthTodos.length;
	const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

	return { completed, total, percentage };
}
