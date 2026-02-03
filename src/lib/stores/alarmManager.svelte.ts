import { memosStore } from './memos.svelte';
import { notificationStore } from './notifications.svelte';
import type { Memo, Reminder } from '$lib/types/memo';

export interface AlarmGroupItem {
	memoId: string;
	memoTitle: string;
	reminderId: string;
	type: 'repeat' | 'once';
	days?: number[];
	date?: string;
	enabled: boolean;
}

export interface AlarmGroup {
	time: string;
	enabled: boolean;
	items: AlarmGroupItem[];
}

// 메모에서 알림 목록 추출 (하위 호환성 지원)
function getRemindersFromMemo(memo: Memo): Array<Reminder & { memoId: string; memoTitle: string }> {
	const results: Array<Reminder & { memoId: string; memoTitle: string }> = [];

	// 새 형식: reminders 배열
	if (memo.reminders && memo.reminders.length > 0) {
		memo.reminders.forEach(r => {
			results.push({ ...r, memoId: memo.id, memoTitle: memo.title });
		});
	}
	// 구 형식: reminder 단일 객체
	else if (memo.reminder) {
		results.push({
			...memo.reminder,
			id: memo.reminder.id || memo.id,
			memoId: memo.id,
			memoTitle: memo.title
		});
	}

	return results;
}

function createAlarmManagerStore() {
	let alarmGroups = $state<AlarmGroup[]>([]);
	let loading = $state(false);

	// 시간별 그룹화
	function groupByTime(memos: Memo[]): AlarmGroup[] {
		const groups = new Map<string, AlarmGroup>();

		memos.forEach(memo => {
			const reminders = getRemindersFromMemo(memo);

			reminders.forEach(reminder => {
				if (!reminder.enabled) return;

				const time = reminder.time;

				if (!groups.has(time)) {
					groups.set(time, {
						time,
						enabled: true,
						items: []
					});
				}

				groups.get(time)!.items.push({
					memoId: reminder.memoId,
					memoTitle: reminder.memoTitle,
					reminderId: reminder.id,
					type: reminder.type || 'repeat',
					days: reminder.days,
					date: reminder.date,
					enabled: reminder.enabled
				});
			});
		});

		// 시간순 정렬
		return Array.from(groups.values())
			.sort((a, b) => a.time.localeCompare(b.time));
	}

	// 그룹 데이터 새로고침
	function refresh() {
		alarmGroups = groupByTime(memosStore.memos);
	}

	// 시간대 토글
	async function toggleTimeSlot(time: string, enabled: boolean): Promise<void> {
		const group = alarmGroups.find(g => g.time === time);
		if (!group) return;

		loading = true;

		try {
			// 해당 시간의 모든 메모 알림 상태 변경
			const updatePromises = group.items.map(item =>
				memosStore.updateReminderEnabled(item.memoId, item.reminderId, enabled)
			);

			await Promise.all(updatePromises);

			// 그룹 상태 갱신
			group.enabled = enabled;
			group.items.forEach(item => item.enabled = enabled);
			alarmGroups = [...alarmGroups];

			// Service Worker 동기화
			notificationStore.syncRemindersToServiceWorker();
		} finally {
			loading = false;
		}
	}

	// 개별 알림 토글
	async function toggleReminder(
		memoId: string,
		reminderId: string,
		enabled: boolean
	): Promise<void> {
		loading = true;

		try {
			await memosStore.updateReminderEnabled(memoId, reminderId, enabled);
			refresh();
			notificationStore.syncRemindersToServiceWorker();
		} finally {
			loading = false;
		}
	}

	// 모든 알림 비활성화
	async function disableAll(): Promise<void> {
		loading = true;

		try {
			const allUpdates: Promise<boolean>[] = [];

			alarmGroups.forEach(group => {
				group.items.forEach(item => {
					allUpdates.push(
						memosStore.updateReminderEnabled(item.memoId, item.reminderId, false)
					);
				});
			});

			await Promise.all(allUpdates);
			refresh();
			notificationStore.syncRemindersToServiceWorker();
		} finally {
			loading = false;
		}
	}

	// 전체 알림 수
	function getTotalCount(): number {
		return alarmGroups.reduce((sum, group) => sum + group.items.length, 0);
	}

	return {
		get groups() { return alarmGroups; },
		get loading() { return loading; },
		get totalCount() { return getTotalCount(); },
		refresh,
		groupByTime,
		toggleTimeSlot,
		toggleReminder,
		disableAll
	};
}

export const alarmManagerStore = createAlarmManagerStore();
