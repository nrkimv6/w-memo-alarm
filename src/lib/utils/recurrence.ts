import type { Recurrence, TodoInstance, Memo } from '$lib/types/memo';

/**
 * 반복 할일 유틸리티 (Phase 3)
 * JIT (Just-in-Time) 인스턴스 생성 방식
 */

/**
 * 다음 반복 일정 날짜 계산
 */
export function getNextOccurrence(recurrence: Recurrence, fromDate: Date): Date | null {
	const next = new Date(fromDate);

	switch (recurrence.type) {
		case 'daily':
			next.setDate(next.getDate() + (recurrence.interval || 1));
			return next;

		case 'weekly':
			if (!recurrence.daysOfWeek || recurrence.daysOfWeek.length === 0) {
				return null;
			}
			return getNextWeekdayOccurrence(next, recurrence.daysOfWeek, recurrence.interval || 1);

		case 'monthly':
			if (!recurrence.dayOfMonth) return null;
			return getNextMonthlyOccurrence(next, recurrence.dayOfMonth, recurrence.interval || 1);

		case 'custom':
			if (!recurrence.customInterval || !recurrence.customUnit) return null;
			return getNextCustomOccurrence(next, recurrence.customInterval, recurrence.customUnit);

		default:
			return null;
	}
}

/**
 * 다음 요일 발생 날짜 계산 (매주 반복)
 */
function getNextWeekdayOccurrence(
	fromDate: Date,
	daysOfWeek: number[],
	interval: number
): Date {
	const sorted = [...daysOfWeek].sort((a, b) => a - b);
	const currentDay = fromDate.getDay();

	// 이번 주 내에서 다음 요일 찾기
	for (const day of sorted) {
		if (day > currentDay) {
			const next = new Date(fromDate);
			next.setDate(fromDate.getDate() + (day - currentDay));
			return next;
		}
	}

	// 이번 주에 없으면 다음 주 첫 번째 요일
	const firstDay = sorted[0];
	const daysUntilNext = 7 - currentDay + firstDay + (interval - 1) * 7;
	const next = new Date(fromDate);
	next.setDate(fromDate.getDate() + daysUntilNext);
	return next;
}

/**
 * 다음 월 일자 발생 날짜 계산 (매월 반복)
 */
function getNextMonthlyOccurrence(fromDate: Date, dayOfMonth: number, interval: number): Date {
	const next = new Date(fromDate);
	next.setMonth(next.getMonth() + interval);
	next.setDate(dayOfMonth);

	// 해당 월에 그 날짜가 없으면 (예: 2월 31일) 마지막 날로 조정
	if (next.getDate() !== dayOfMonth) {
		next.setDate(0); // 이전 달 마지막 날
	}

	return next;
}

/**
 * 사용자 지정 간격 계산
 */
function getNextCustomOccurrence(
	fromDate: Date,
	interval: number,
	unit: 'day' | 'week' | 'month'
): Date {
	const next = new Date(fromDate);

	switch (unit) {
		case 'day':
			next.setDate(next.getDate() + interval);
			break;
		case 'week':
			next.setDate(next.getDate() + interval * 7);
			break;
		case 'month':
			next.setMonth(next.getMonth() + interval);
			break;
	}

	return next;
}

/**
 * 반복 종료 여부 체크
 */
export function hasReachedEnd(recurrence: Recurrence, instances: TodoInstance[]): boolean {
	// 종료 조건이 없으면 무한 반복
	if (!recurrence.endDate && !recurrence.endAfter) {
		return false;
	}

	// 날짜 기준 종료
	if (recurrence.endDate) {
		const endDate = new Date(recurrence.endDate);
		const lastInstance = instances[instances.length - 1];
		if (lastInstance) {
			const lastDate = new Date(lastInstance.scheduledDate);
			return lastDate >= endDate;
		}
	}

	// 횟수 기준 종료
	if (recurrence.endAfter) {
		const completedCount = instances.filter((i) => i.status === 'completed').length;
		return completedCount >= recurrence.endAfter;
	}

	return false;
}

/**
 * 현재 활성 인스턴스 가져오기 (pending 상태)
 */
export function getActiveInstance(instances: TodoInstance[]): TodoInstance | undefined {
	return instances.find((i) => i.status === 'pending');
}

/**
 * 다음 인스턴스 생성
 */
export function createNextInstance(
	recurrence: Recurrence,
	instances: TodoInstance[],
	baseDate?: Date
): TodoInstance | null {
	// 종료 체크
	if (hasReachedEnd(recurrence, instances)) {
		return null;
	}

	// 기준 날짜 (마지막 인스턴스의 scheduledDate 또는 현재 시각)
	const lastInstance = instances.length > 0 ? instances[instances.length - 1] : null;
	const from = baseDate || (lastInstance ? new Date(lastInstance.scheduledDate) : new Date());

	const nextDate = getNextOccurrence(recurrence, from);
	if (!nextDate) return null;

	return {
		id: generateInstanceId(),
		scheduledDate: nextDate.toISOString().split('T')[0],
		status: 'pending',
		postponeCount: 0
	};
}

/**
 * 인스턴스 ID 생성
 */
function generateInstanceId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 9);
	return `inst_${timestamp}_${random}`;
}

/**
 * 반복 패턴 설명 텍스트
 */
export function getRecurrenceDescription(recurrence: Recurrence): string {
	const parts: string[] = [];

	switch (recurrence.type) {
		case 'daily':
			parts.push(recurrence.interval === 1 ? '매일' : `${recurrence.interval}일마다`);
			break;
		case 'weekly':
			if (recurrence.daysOfWeek) {
				const days = ['일', '월', '화', '수', '목', '금', '토'];
				const dayLabels = recurrence.daysOfWeek.map((d) => days[d]).join(', ');
				parts.push(`매주 ${dayLabels}`);
			}
			break;
		case 'monthly':
			if (recurrence.dayOfMonth) {
				parts.push(`매월 ${recurrence.dayOfMonth}일`);
			}
			break;
		case 'custom':
			if (recurrence.customInterval && recurrence.customUnit) {
				const unitLabel = { day: '일', week: '주', month: '월' }[recurrence.customUnit];
				parts.push(`${recurrence.customInterval}${unitLabel}마다`);
			}
			break;
	}

	// 종료 조건
	if (recurrence.endDate) {
		const end = new Date(recurrence.endDate);
		parts.push(`${end.getMonth() + 1}/${end.getDate()}까지`);
	} else if (recurrence.endAfter) {
		parts.push(`${recurrence.endAfter}회`);
	}

	return parts.join(' · ');
}

/**
 * 앱 시작 시 누락된 인스턴스 복구
 */
export function recoverMissingInstances(memo: Memo): TodoInstance[] {
	if (!memo.recurrence || !memo.todoInstances) {
		return [];
	}

	const instances = memo.todoInstances;
	const activeInstance = getActiveInstance(instances);

	const newInstances: TodoInstance[] = [];

	// 활성 인스턴스가 없고 마지막이 완료/건너뜀인 경우
	if (!activeInstance && instances.length > 0) {
		const lastInstance = instances[instances.length - 1];
		if (lastInstance.status === 'completed' || lastInstance.status === 'skipped') {
			const nextInstance = createNextInstance(memo.recurrence, instances);
			if (nextInstance) {
				newInstances.push(nextInstance);
			}
		}
	}

	// Overdue 인스턴스가 있고 다음 정규 일정이 이미 도래한 경우
	if (activeInstance) {
		const activeDate = new Date(activeInstance.scheduledDate);
		const now = new Date();
		const isOverdue = activeDate < now;

		if (isOverdue) {
			// 다음 일정 계산
			const nextDate = getNextOccurrence(memo.recurrence, activeDate);
			if (nextDate && nextDate <= now) {
				// 다음 인스턴스도 생성 (overdue + 새 인스턴스 공존)
				const nextInstance = createNextInstance(memo.recurrence, instances, nextDate);
				if (nextInstance) {
					newInstances.push(nextInstance);
				}
			}
		}
	}

	return newInstances;
}

/**
 * 미래 N개 일정 미리보기 계산 (실제 인스턴스 미생성)
 */
export function getUpcomingSchedules(
	recurrence: Recurrence,
	instances: TodoInstance[],
	count: number
): Array<{ date: string; isPostponed: boolean; isActive: boolean }> {
	const schedules: Array<{ date: string; isPostponed: boolean; isActive: boolean }> = [];

	// 현재 활성 인스턴스
	const activeInstance = getActiveInstance(instances);
	if (activeInstance) {
		schedules.push({
			date: activeInstance.scheduledDate,
			isPostponed: activeInstance.postponeCount > 0,
			isActive: true
		});
	}

	// 미래 일정 계산
	const lastInstance = instances.length > 0 ? instances[instances.length - 1] : null;
	const from = lastInstance ? new Date(lastInstance.scheduledDate) : new Date();

	let current = from;
	for (let i = schedules.length; i < count; i++) {
		const next = getNextOccurrence(recurrence, current);
		if (!next) break;

		// 종료 체크
		if (recurrence.endDate && next > new Date(recurrence.endDate)) break;
		if (recurrence.endAfter && i >= recurrence.endAfter) break;

		schedules.push({
			date: next.toISOString().split('T')[0],
			isPostponed: false,
			isActive: false
		});

		current = next;
	}

	return schedules;
}
