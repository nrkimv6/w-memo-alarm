import type { Memo } from '$lib/types/memo';

/**
 * Phase 4 Section 6: 완료 통계 유틸리티
 */

/**
 * 연속 완료 일수 계산
 * 매일 할일을 모두 완료한 연속 일수 반환
 */
export function calculateStreak(todos: Memo[]): number {
	if (todos.length === 0) return 0;

	let streak = 0;
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// 오늘부터 과거로 거슬러 올라가며 체크
	for (let i = 0; i < 365; i++) {
		// 최대 1년까지만 체크
		const checkDate = new Date(today);
		checkDate.setDate(today.getDate() - i);
		const dateStr = checkDate.toISOString().split('T')[0];

		// 해당 날짜의 할일 찾기
		const dayTodos = todos.filter((t) => {
			if (t.memoType !== 'todo' || t.todoStatus === 'skipped') return false;

			// 반복 할일: 인스턴스의 scheduledDate 확인
			if (t.recurrence && t.todoInstances) {
				return t.todoInstances.some(
					(inst) =>
						inst.scheduledDate === dateStr &&
						(inst.status === 'completed' || inst.status === 'pending')
				);
			}

			// 단발성 할일: dueDate가 해당 날짜인 경우
			return t.dueDate === dateStr;
		});

		// 해당 날짜에 할일이 없으면 스킵 (할일이 없는 날은 연속으로 카운트)
		if (dayTodos.length === 0) {
			continue;
		}

		// 해당 날짜의 할일이 모두 완료되었는지 확인
		const allCompleted = dayTodos.every((t) => {
			if (t.recurrence && t.todoInstances) {
				const inst = t.todoInstances.find((i) => i.scheduledDate === dateStr);
				return inst && inst.status === 'completed';
			}
			return t.todoStatus === 'completed';
		});

		if (allCompleted) {
			streak++;
		} else {
			// 오늘 할일이 미완료면 스트릭 0
			// 과거 날짜가 미완료면 스트릭 종료
			if (i === 0) {
				return 0; // 오늘 미완료
			}
			break; // 과거 날짜 미완료로 스트릭 끊김
		}
	}

	return streak;
}

/**
 * 가장 많이 미룬 할일 Top N
 */
export function getMostPostponedTodos(todos: Memo[], topN: number = 3): Memo[] {
	const todosWithPostpone = todos.filter(
		(t) => t.memoType === 'todo' && t.postponeInfo && t.postponeInfo.count > 0
	);

	return todosWithPostpone.sort((a, b) => {
		const aCount = a.postponeInfo?.count || 0;
		const bCount = b.postponeInfo?.count || 0;
		return bCount - aCount; // 내림차순
	}).slice(0, topN);
}

/**
 * 전체 통계 요약
 */
export interface TodoStatsSummary {
	// 완료율
	todayProgress: { completed: number; total: number; percentage: number };
	weekProgress: { completed: number; total: number; percentage: number };
	monthProgress: { completed: number; total: number; percentage: number };

	// 스트릭
	streak: number;

	// 미루기 통계
	mostPostponedTodos: Memo[];
	totalPostpones: number;

	// 전체 통계
	totalTodos: number;
	totalCompleted: number;
	totalPending: number;
	totalSkipped: number;
}

export function getTodoStatsSummary(
	todos: Memo[],
	todayProgress: { completed: number; total: number; percentage: number },
	weekProgress: { completed: number; total: number; percentage: number },
	monthProgress: { completed: number; total: number; percentage: number }
): TodoStatsSummary {
	const allTodos = todos.filter((t) => t.memoType === 'todo');

	return {
		todayProgress,
		weekProgress,
		monthProgress,
		streak: calculateStreak(todos),
		mostPostponedTodos: getMostPostponedTodos(todos),
		totalPostpones: allTodos.reduce((sum, t) => sum + (t.postponeInfo?.count || 0), 0),
		totalTodos: allTodos.length,
		totalCompleted: allTodos.filter((t) => t.todoStatus === 'completed').length,
		totalPending: allTodos.filter((t) => t.todoStatus === 'pending').length,
		totalSkipped: allTodos.filter((t) => t.todoStatus === 'skipped').length
	};
}
