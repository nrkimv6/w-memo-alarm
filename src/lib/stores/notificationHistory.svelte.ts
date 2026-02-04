import type { NotificationHistory } from '$lib/types/memo';
import { supabase } from '$lib/services/supabase';
import { authStore } from '$lib/stores/auth.svelte';
import { networkStatus } from '$lib/services/networkStatus.svelte';

const STORAGE_KEY = 'memo-alarm:notification-history';
const PENDING_SYNC_KEY = 'memo-alarm:notification-history-pending';
const MAX_RECORDS = 500;
const RETENTION_DAYS = 90;
const TABLE_NAME = 'ma_notification_history';

function generateNotiId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 9);
	return `noti_${timestamp}_${random}`;
}

// Supabase row → NotificationHistory
function rowToRecord(row: Record<string, unknown>): NotificationHistory {
	return {
		id: row.id as string,
		memoId: row.memo_id as string,
		memoTitle: row.memo_title as string,
		reminderId: row.reminder_id as string || '',
		reminderType: row.reminder_type as NotificationHistory['reminderType'],
		channel: row.channel as NotificationHistory['channel'],
		status: row.status as NotificationHistory['status'],
		errorMessage: (row.error_message as string) || undefined,
		sentAt: row.sent_at as string,
		readAt: (row.read_at as string) || undefined
	};
}

// NotificationHistory → Supabase insert row
function recordToRow(record: NotificationHistory, userId: string) {
	return {
		id: record.id,
		user_id: userId,
		memo_id: record.memoId,
		memo_title: record.memoTitle,
		reminder_id: record.reminderId || null,
		reminder_type: record.reminderType,
		channel: record.channel,
		status: record.status,
		error_message: record.errorMessage || null,
		sent_at: record.sentAt,
		read_at: record.readAt || null
	};
}

function createNotificationHistoryStore() {
	let histories = $state<NotificationHistory[]>([]);
	let initialized = $state(false);
	let pendingSyncIds = $state<string[]>([]); // 아직 서버에 안 올라간 ID들
	let networkUnsubscribe: (() => void) | null = null;

	function loadFromStorage() {
		if (typeof window === 'undefined') return;
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				histories = JSON.parse(saved);
			}
		} catch (e) {
			console.error('Failed to load notification history:', e);
			histories = [];
		}
		try {
			const pending = localStorage.getItem(PENDING_SYNC_KEY);
			if (pending) {
				pendingSyncIds = JSON.parse(pending);
			}
		} catch {
			pendingSyncIds = [];
		}
	}

	function saveToStorage() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(histories));
		} catch (e) {
			console.error('Failed to save notification history:', e);
		}
	}

	function savePendingSync() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pendingSyncIds));
		} catch {
			// ignore
		}
	}

	// --- Supabase 동기화 ---

	async function uploadToSupabase(record: NotificationHistory): Promise<boolean> {
		if (!authStore.isAuthenticated || !authStore.user) return false;
		try {
			const { error } = await supabase
				.from(TABLE_NAME)
				.upsert(recordToRow(record, authStore.user.id));
			if (error) {
				console.error('Failed to upload notification history:', error);
				return false;
			}
			return true;
		} catch (e) {
			console.error('Upload exception:', e);
			return false;
		}
	}

	async function syncPendingRecords() {
		if (!authStore.isAuthenticated || !authStore.user || pendingSyncIds.length === 0) return;
		if (!networkStatus.isOnline) return;

		const idsToSync = [...pendingSyncIds];
		const successIds: string[] = [];

		for (const id of idsToSync) {
			const record = histories.find((h) => h.id === id);
			if (!record) {
				// 이미 삭제된 레코드 — pending에서 제거
				successIds.push(id);
				continue;
			}
			const ok = await uploadToSupabase(record);
			if (ok) {
				successIds.push(id);
			}
		}

		if (successIds.length > 0) {
			pendingSyncIds = pendingSyncIds.filter((id) => !successIds.includes(id));
			savePendingSync();
		}
	}

	async function fetchFromSupabase() {
		if (!authStore.isAuthenticated || !authStore.user) return;
		if (!networkStatus.isOnline) return;

		try {
			const { data, error } = await supabase
				.from(TABLE_NAME)
				.select('*')
				.eq('user_id', authStore.user.id)
				.order('sent_at', { ascending: false })
				.limit(MAX_RECORDS);

			if (error) {
				console.error('Failed to fetch notification history:', error);
				return;
			}

			if (!data || data.length === 0) return;

			const serverRecords = data.map(rowToRecord);

			// 서버 데이터와 로컬 pending 데이터 병합
			const pendingRecords = histories.filter((h) => pendingSyncIds.includes(h.id));
			const serverIds = new Set(serverRecords.map((r) => r.id));
			const localOnly = pendingRecords.filter((h) => !serverIds.has(h.id));

			histories = [...localOnly, ...serverRecords]
				.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
				.slice(0, MAX_RECORDS);

			saveToStorage();
		} catch (e) {
			console.error('Fetch exception:', e);
		}
	}

	async function deleteFromSupabase(id: string) {
		if (!authStore.isAuthenticated) return;
		try {
			await supabase.from(TABLE_NAME).delete().eq('id', id);
		} catch (e) {
			console.error('Delete from supabase failed:', e);
		}
	}

	async function clearFromSupabase() {
		if (!authStore.isAuthenticated || !authStore.user) return;
		try {
			await supabase.from(TABLE_NAME).delete().eq('user_id', authStore.user.id);
		} catch (e) {
			console.error('Clear from supabase failed:', e);
		}
	}

	// --- 핵심 함수들 ---

	function addRecord(record: Omit<NotificationHistory, 'id'>) {
		const newRecord: NotificationHistory = {
			id: generateNotiId(),
			...record
		};
		histories = [newRecord, ...histories].slice(0, MAX_RECORDS);
		saveToStorage();

		// Supabase 동기화 시도
		if (authStore.isAuthenticated && networkStatus.isOnline) {
			uploadToSupabase(newRecord).then((ok) => {
				if (!ok) {
					pendingSyncIds = [...pendingSyncIds, newRecord.id];
					savePendingSync();
				}
			});
		} else if (authStore.isAuthenticated) {
			// 오프라인 — pending 큐에 추가
			pendingSyncIds = [...pendingSyncIds, newRecord.id];
			savePendingSync();
		}
	}

	function cleanup() {
		const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
		const before = histories.length;
		histories = histories.filter((h) => new Date(h.sentAt).getTime() > cutoff);
		if (histories.length !== before) {
			saveToStorage();
		}
	}

	function init() {
		if (initialized || typeof window === 'undefined') return;
		loadFromStorage();
		cleanup();
		initialized = true;

		// 온라인 복귀 시 pending 동기화
		networkUnsubscribe = networkStatus.onStatusChange((isOnline) => {
			if (isOnline) {
				syncPendingRecords();
			}
		});

		// 초기 동기화: 서버에서 가져오기 + pending 업로드
		if (authStore.isAuthenticated && networkStatus.isOnline) {
			fetchFromSupabase().then(() => syncPendingRecords());
		}
	}

	function getByMemoId(memoId: string): NotificationHistory[] {
		return histories.filter((h) => h.memoId === memoId);
	}

	function getByDateRange(startDate: string, endDate: string): NotificationHistory[] {
		const start = new Date(startDate).getTime();
		const end = new Date(endDate).getTime();
		return histories.filter((h) => {
			const t = new Date(h.sentAt).getTime();
			return t >= start && t <= end;
		});
	}

	function getGroupedByDate(): Record<string, NotificationHistory[]> {
		const grouped: Record<string, NotificationHistory[]> = {};
		for (const h of histories) {
			const dateKey = h.sentAt.split('T')[0]; // YYYY-MM-DD
			if (!grouped[dateKey]) {
				grouped[dateKey] = [];
			}
			grouped[dateKey].push(h);
		}
		return grouped;
	}

	function getByStatus(status: NotificationHistory['status']): NotificationHistory[] {
		return histories.filter((h) => h.status === status);
	}

	function deleteById(id: string) {
		histories = histories.filter((h) => h.id !== id);
		pendingSyncIds = pendingSyncIds.filter((pid) => pid !== id);
		saveToStorage();
		savePendingSync();
		deleteFromSupabase(id);
	}

	function deleteByDateRange(startDate: string, endDate: string) {
		const start = new Date(startDate).getTime();
		const end = new Date(endDate).getTime();
		const toDelete = histories.filter((h) => {
			const t = new Date(h.sentAt).getTime();
			return t >= start && t <= end;
		});
		histories = histories.filter((h) => {
			const t = new Date(h.sentAt).getTime();
			return t < start || t > end;
		});
		saveToStorage();

		// 서버에서도 삭제
		for (const h of toDelete) {
			deleteFromSupabase(h.id);
		}
	}

	function getStats() {
		const total = histories.length;
		const success = histories.filter((h) => h.status === 'success').length;
		const failed = histories.filter((h) => h.status === 'failed').length;
		const unknown = histories.filter((h) => h.status === 'unknown').length;
		const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

		// 가장 많이 발송된 메모 Top 3
		const memoCounts: Record<string, { title: string; count: number }> = {};
		for (const h of histories) {
			if (!memoCounts[h.memoId]) {
				memoCounts[h.memoId] = { title: h.memoTitle, count: 0 };
			}
			memoCounts[h.memoId].count++;
		}
		const topMemos = Object.values(memoCounts)
			.sort((a, b) => b.count - a.count)
			.slice(0, 3);

		return { total, success, failed, unknown, successRate, topMemos };
	}

	function clearAll() {
		histories = [];
		pendingSyncIds = [];
		saveToStorage();
		savePendingSync();
		clearFromSupabase();
	}

	return {
		get histories() {
			return histories;
		},
		get initialized() {
			return initialized;
		},
		init,
		addRecord,
		cleanup,
		getByMemoId,
		getByDateRange,
		getGroupedByDate,
		getByStatus,
		deleteById,
		deleteByDateRange,
		getStats,
		clearAll
	};
}

export const notificationHistoryStore = createNotificationHistoryStore();
