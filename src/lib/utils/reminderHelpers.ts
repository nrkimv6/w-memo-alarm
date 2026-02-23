/**
 * Reminder 관련 헬퍼 함수 (Memo 타입에만 의존)
 */

import type { Memo, Reminder } from '$lib/types/memo';
import { generateReminderId } from '$lib/utils/memoIdGenerator';

// 기존 단일 reminder를 reminders 배열로 마이그레이션
export function migrateToMultipleReminders(memo: Memo): Memo {
	// 이미 reminders가 있으면 스킵
	if (memo.reminders && memo.reminders.length > 0) {
		return memo;
	}

	// reminder가 있으면 reminders로 변환
	if (memo.reminder) {
		return {
			...memo,
			reminders: [{
				...memo.reminder,
				id: memo.reminder.id || generateReminderId(),
				isDefault: memo.reminder.isDefault ?? true
			}],
			reminder: undefined // 기존 필드 제거
		};
	}

	return memo;
}

// 메모의 알림 목록 가져오기 (하위 호환성 지원)
export function getRemindersFromMemo(memo: Memo): Reminder[] {
	if (memo.reminders && memo.reminders.length > 0) {
		return memo.reminders;
	}
	if (memo.reminder) {
		return [{
			...memo.reminder,
			id: memo.reminder.id || generateReminderId()
		}];
	}
	return [];
}

// 기본 알림 가져오기
export function getDefaultReminderFromMemo(memo: Memo): Reminder | undefined {
	const reminders = getRemindersFromMemo(memo);
	return reminders.find(r => r.isDefault);
}

// 추가 알림 목록 가져오기
export function getAdditionalRemindersFromMemo(memo: Memo): Reminder[] {
	const reminders = getRemindersFromMemo(memo);
	return reminders.filter(r => !r.isDefault);
}
