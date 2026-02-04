import type { Memo, TodoStatus } from '$lib/types/memo';

/**
 * 할일이 기한을 초과했는지 확인
 */
export function isOverdue(memo: Memo): boolean {
	if (memo.memoType !== 'todo') return false;
	if (memo.todoStatus !== 'pending') return false;
	if (!memo.dueDate) return false;

	const now = new Date();
	const dueDateTime = new Date(memo.dueDate);

	// dueTime이 있으면 시간까지 포함
	if (memo.dueTime) {
		const [hours, minutes] = memo.dueTime.split(':').map(Number);
		dueDateTime.setHours(hours, minutes, 59, 999); // 해당 분의 마지막 초까지
	} else {
		// 시간이 없으면 하루 종일로 간주 (23:59:59)
		dueDateTime.setHours(23, 59, 59, 999);
	}

	return now > dueDateTime;
}

/**
 * 할일의 기한을 포맷팅 (예: "2/5(수) 18:00")
 */
export function formatDueDate(memo: Memo): string {
	if (!memo.dueDate) return '';

	const date = new Date(memo.dueDate);
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
	const weekday = weekdays[date.getDay()];

	let result = `${month}/${day}(${weekday})`;

	if (memo.dueTime && memo.dueTime !== '23:59') {
		result += ` ${memo.dueTime}`;
	}

	return result;
}

/**
 * 기한 초과 일수 계산
 */
export function getOverdueDays(memo: Memo): number {
	if (!isOverdue(memo)) return 0;

	const now = new Date();
	const dueDate = new Date(memo.dueDate!);

	if (memo.dueTime) {
		const [hours, minutes] = memo.dueTime.split(':').map(Number);
		dueDate.setHours(hours, minutes, 0, 0);
	} else {
		dueDate.setHours(23, 59, 59, 999);
	}

	const diff = now.getTime() - dueDate.getTime();
	return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * 날짜별로 할일 그룹핑
 */
export function groupTodosByDate(todos: Memo[]): Map<string, Memo[]> {
	const groups = new Map<string, Memo[]>();

	for (const todo of todos) {
		const key = todo.dueDate || 'no-due-date';
		const group = groups.get(key) || [];
		group.push(todo);
		groups.set(key, group);
	}

	// 각 그룹 내에서 정렬: dueTime -> createdAt
	for (const [key, group] of groups) {
		group.sort((a, b) => {
			// dueTime으로 정렬
			const timeA = a.dueTime || '23:59';
			const timeB = b.dueTime || '23:59';

			if (timeA !== timeB) {
				return timeA.localeCompare(timeB);
			}

			// 동일 시각이면 생성순
			return a.createdAt - b.createdAt;
		});
	}

	return groups;
}

/**
 * 할일 필터링
 */
export function filterTodos(
	todos: Memo[],
	filter: 'today' | 'week' | 'all' | 'completed'
): Memo[] {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

	// 이번 주 시작일 (일요일)
	const weekStart = new Date(today);
	weekStart.setDate(today.getDate() - today.getDay());

	// 이번 주 종료일 (토요일)
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 6);

	return todos.filter((todo) => {
		if (todo.memoType !== 'todo') return false;

		switch (filter) {
			case 'today':
				// 오늘 기한 + 기한 없는 미완료 + overdue
				if (todo.todoStatus === 'completed') return false;
				if (isOverdue(todo)) return true;
				if (!todo.dueDate) return true; // 기한 없는 할일 포함
				const dueDate = new Date(todo.dueDate);
				return dueDate.toDateString() === today.toDateString();

			case 'week':
				// 이번 주 기한
				if (!todo.dueDate) return false;
				if (todo.todoStatus === 'completed') return false;
				const weekDueDate = new Date(todo.dueDate);
				return weekDueDate >= weekStart && weekDueDate <= weekEnd;

			case 'all':
				// 미완료 전체
				return todo.todoStatus !== 'completed';

			case 'completed':
				// 완료된 할일
				return todo.todoStatus === 'completed';

			default:
				return false;
		}
	});
}

/**
 * 할일 정렬 (overdue -> 날짜 -> 시간 -> 생성순)
 */
export function sortTodos(todos: Memo[]): Memo[] {
	return [...todos].sort((a, b) => {
		const aOverdue = isOverdue(a);
		const bOverdue = isOverdue(b);

		// overdue가 최상단
		if (aOverdue && !bOverdue) return -1;
		if (!aOverdue && bOverdue) return 1;

		// 완료된 할일은 최하단
		const aCompleted = a.todoStatus === 'completed';
		const bCompleted = b.todoStatus === 'completed';

		if (aCompleted && !bCompleted) return 1;
		if (!aCompleted && bCompleted) return -1;

		// 기한 없는 할일은 중간
		if (!a.dueDate && !b.dueDate) {
			return a.createdAt - b.createdAt;
		}
		if (!a.dueDate) return 1;
		if (!b.dueDate) return -1;

		// 날짜 비교
		const dateCompare = a.dueDate.localeCompare(b.dueDate);
		if (dateCompare !== 0) return dateCompare;

		// 시간 비교
		const timeA = a.dueTime || '23:59';
		const timeB = b.dueTime || '23:59';
		const timeCompare = timeA.localeCompare(timeB);
		if (timeCompare !== 0) return timeCompare;

		// 생성순
		return a.createdAt - b.createdAt;
	});
}

/**
 * 오늘 할일 진행률 계산
 */
export function getTodayProgress(todos: Memo[]): { total: number; completed: number; percentage: number } {
	const todayTodos = filterTodos(todos, 'today').filter(t => t.todoStatus !== 'skipped');
	const completed = todayTodos.filter((t) => t.todoStatus === 'completed').length;
	const total = todayTodos.length;
	const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

	return { total, completed, percentage };
}

/**
 * 우선순위 배지 색상
 */
export function getPriorityColor(priority: string): string {
	switch (priority) {
		case 'urgent':
			return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200';
		case 'high':
			return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200';
		case 'medium':
			return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200';
		case 'low':
			return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
		default:
			return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
	}
}

/**
 * 우선순위 라벨
 */
export function getPriorityLabel(priority: string): string {
	switch (priority) {
		case 'urgent':
			return '긴급';
		case 'high':
			return '높음';
		case 'medium':
			return '보통';
		case 'low':
			return '낮음';
		default:
			return '';
	}
}
