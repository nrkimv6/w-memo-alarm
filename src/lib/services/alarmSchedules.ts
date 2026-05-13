// 알림 스케줄 관리 (Supabase alarm_schedules 테이블)

import { supabase } from './supabase';
import type { Reminder } from '$lib/types/memo';

export type AlarmType = 'memo_reminder';

export interface AlarmSchedule {
	id?: string;
	user_id: string;
	app_name?: string;
	alarm_type: AlarmType;
	alarm_time: string; // HH:MM:SS
	timezone?: string;
	is_enabled?: boolean;
	notification_title: string;
	notification_body: string;
	days_of_week?: number[] | null; // [0,1,2,3,4,5,6] (일~토), null이면 매일
	target_date?: string | null; // YYYY-MM-DD, null이면 반복 알림
	metadata?: Record<string, unknown>;
}

/**
 * 메모 알림 스케줄 생성
 */
export async function createMemoAlarm(
	userId: string,
	memoId: string,
	memoTitle: string,
	reminder: Reminder
): Promise<AlarmSchedule | null> {
	if (!supabase) {
		throw new Error('Supabase not configured');
	}

	if (!reminder.enabled) {
		return null;
	}

	const schedule: Omit<AlarmSchedule, 'id'> = {
		user_id: userId,
		app_name: 'memo-alarm',
		alarm_type: 'memo_reminder',
		alarm_time: reminder.time + ':00', // HH:MM -> HH:MM:SS
		is_enabled: true,
		notification_title: memoTitle,
		notification_body: reminder.type === 'once' ? '일회성 알림' : '반복 알림',
		days_of_week: reminder.type === 'repeat' ? reminder.days : null,
		target_date: reminder.type === 'once' ? reminder.date : null,
		metadata: { memo_id: memoId, auto_open: reminder.autoOpen }
	};

	const { data, error } = await supabase
		.from('alarm_schedules')
		.insert(schedule)
		.select()
		.single();

	if (error) {
		console.error('Failed to create memo alarm:', error);
		throw error;
	}

	return data;
}

/**
 * 메모 알림 스케줄 갱신 (삭제 후 재생성)
 */
export async function updateMemoAlarm(
	userId: string,
	memoId: string,
	memoTitle: string,
	reminder: Reminder | undefined
): Promise<AlarmSchedule | null> {
	// 기존 알림 삭제
	await deleteMemoAlarms(memoId);

	// 새 알림 생성 (리마인더가 있고 활성화된 경우에만)
	if (reminder?.enabled) {
		return createMemoAlarm(userId, memoId, memoTitle, reminder);
	}

	return null;
}

/**
 * 메모의 모든 알림 동기화 (reminders 배열 지원)
 */
export async function syncMemoAlarms(
	userId: string,
	memoId: string,
	memoTitle: string,
	reminders: Reminder[]
): Promise<void> {
	// 기존 알림 모두 삭제
	await deleteMemoAlarms(memoId);

	// 활성화된 알림만 생성
	const enabledReminders = reminders.filter(r => r.enabled);

	for (const reminder of enabledReminders) {
		await createMemoAlarm(userId, memoId, memoTitle, reminder);
	}
}

/**
 * 메모 삭제 시 관련 알림 삭제
 */
export async function deleteMemoAlarms(memoId: string): Promise<void> {
	if (!supabase) {
		throw new Error('Supabase not configured');
	}

	// metadata에 memo_id가 포함된 알림 삭제
	const { error } = await supabase
		.from('alarm_schedules')
		.delete()
		.eq('app_name', 'memo-alarm')
		.contains('metadata', { memo_id: memoId });

	if (error) {
		console.error('Failed to delete memo alarms:', error);
		throw error;
	}
}

/**
 * 사용자 계정의 memo-alarm 서버 스케줄 전체 삭제 (기기별 1회 초기화 모달용)
 */
export async function deleteAllMemoAlarmsForUser(userId: string): Promise<void> {
	if (!supabase) {
		throw new Error('Supabase not configured');
	}

	const { error } = await supabase
		.from('alarm_schedules')
		.delete()
		.eq('user_id', userId)
		.eq('app_name', 'memo-alarm')
		.eq('alarm_type', 'memo_reminder');

	if (error) {
		console.error('Failed to delete all memo alarms for user:', error);
		throw error;
	}
}

/**
 * 사용자의 모든 알림 시간 일괄 업데이트
 */
export async function updateUserAlarmTime(userId: string, newAlarmTime: string): Promise<void> {
	if (!supabase) {
		throw new Error('Supabase not configured');
	}

	const { error } = await supabase
		.from('alarm_schedules')
		.update({
			alarm_time: newAlarmTime,
			updated_at: new Date().toISOString()
		})
		.eq('user_id', userId)
		.eq('app_name', 'memo-alarm');

	if (error) {
		console.error('Failed to update alarm time:', error);
		throw error;
	}
}
