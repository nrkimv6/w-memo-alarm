import type { NotificationHistory } from '$lib/types/memo';

const STORAGE_KEY = 'memo-alarm:notification-history';
const MAX_RECORDS = 500;
const RETENTION_DAYS = 90;

function generateNotiId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 9);
	return `noti_${timestamp}_${random}`;
}

function createNotificationHistoryStore() {
	let histories = $state<NotificationHistory[]>([]);
	let initialized = $state(false);

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
	}

	function saveToStorage() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(histories));
		} catch (e) {
			console.error('Failed to save notification history:', e);
		}
	}

	function addRecord(record: Omit<NotificationHistory, 'id'>) {
		const newRecord: NotificationHistory = {
			id: generateNotiId(),
			...record
		};
		histories = [newRecord, ...histories].slice(0, MAX_RECORDS);
		saveToStorage();
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
		saveToStorage();
	}

	function deleteByDateRange(startDate: string, endDate: string) {
		const start = new Date(startDate).getTime();
		const end = new Date(endDate).getTime();
		histories = histories.filter((h) => {
			const t = new Date(h.sentAt).getTime();
			return t < start || t > end;
		});
		saveToStorage();
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
		saveToStorage();
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
