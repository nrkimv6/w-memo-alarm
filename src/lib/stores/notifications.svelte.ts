import type { Memo } from '$lib/types/memo';
import { memosStore } from './memos.svelte';

const STORAGE_KEY = 'memo-alarm:last-notifications';
const SNOOZE_KEY = 'memo-alarm:snoozed-reminders';

export type SnoozeMinutes = 5 | 10 | 30 | 60;

interface SnoozedReminder {
	memoId: string;
	snoozeUntil: number; // timestamp
}

function createNotificationStore() {
	let permission = $state<NotificationPermission>('default');
	let initialized = $state(false);
	let checkInterval: ReturnType<typeof setInterval> | null = null;
	let lastNotifiedMap = $state<Record<string, string>>({});
	let snoozedReminders = $state<SnoozedReminder[]>([]);

	function loadLastNotified() {
		if (typeof window === 'undefined') return;
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				lastNotifiedMap = JSON.parse(saved);
			}
		} catch (e) {
			console.error('Failed to load last notifications:', e);
		}
	}

	function saveLastNotified() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(lastNotifiedMap));
		} catch (e) {
			console.error('Failed to save last notifications:', e);
		}
	}

	function loadSnoozed() {
		if (typeof window === 'undefined') return;
		try {
			const saved = localStorage.getItem(SNOOZE_KEY);
			if (saved) {
				snoozedReminders = JSON.parse(saved);
				// Clean up expired snoozes
				const now = Date.now();
				snoozedReminders = snoozedReminders.filter(s => s.snoozeUntil > now);
				saveSnoozed();
			}
		} catch (e) {
			console.error('Failed to load snoozed reminders:', e);
		}
	}

	function saveSnoozed() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozedReminders));
		} catch (e) {
			console.error('Failed to save snoozed reminders:', e);
		}
	}

	function snooze(memoId: string, minutes: SnoozeMinutes) {
		const snoozeUntil = Date.now() + minutes * 60 * 1000;
		snoozedReminders = snoozedReminders.filter(s => s.memoId !== memoId);
		snoozedReminders = [...snoozedReminders, { memoId, snoozeUntil }];
		saveSnoozed();
	}

	function cancelSnooze(memoId: string) {
		snoozedReminders = snoozedReminders.filter(s => s.memoId !== memoId);
		saveSnoozed();
	}

	function getSnoozedUntil(memoId: string): number | null {
		const snoozed = snoozedReminders.find(s => s.memoId === memoId);
		return snoozed?.snoozeUntil ?? null;
	}

	function init() {
		if (initialized || typeof window === 'undefined') return;

		if ('Notification' in window) {
			permission = Notification.permission;
		}

		loadLastNotified();
		loadSnoozed();
		startBackgroundCheck();
		initialized = true;
	}

	function startBackgroundCheck() {
		if (checkInterval) return;

		// Check every minute
		checkInterval = setInterval(() => {
			checkAndTriggerReminders();
		}, 60000);

		// Initial check
		checkAndTriggerReminders();
	}

	function stopBackgroundCheck() {
		if (checkInterval) {
			clearInterval(checkInterval);
			checkInterval = null;
		}
	}

	function checkAndTriggerReminders() {
		if (permission !== 'granted') return;

		const now = new Date();
		const nowTimestamp = now.getTime();
		const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		const today = now.getDay();
		const todayDate = now.toISOString().split('T')[0];

		// Check snoozed reminders
		snoozedReminders.forEach((snoozed) => {
			if (snoozed.snoozeUntil <= nowTimestamp) {
				const memo = memosStore.getById(snoozed.memoId);
				if (memo) {
					showNotification(memo, true);
					// Auto-open URL if enabled
					if (memo.url && memo.reminder?.autoOpen) {
						window.open(memo.url, '_blank');
						memosStore.incrementOpenCount(memo.id);
					}
				}
				// Remove from snoozed list
				cancelSnooze(snoozed.memoId);
			}
		});

		// Check regular reminders
		memosStore.memos.forEach((memo) => {
			if (!memo.reminder?.enabled) return;

			const reminderTime = memo.reminder.time;
			if (reminderTime !== currentTime) return;

			// Check if already notified for this time today
			const lastNotified = lastNotifiedMap[memo.id];
			const notifyKey = `${todayDate}-${reminderTime}`;
			if (lastNotified === notifyKey) return;

			// Check day/date conditions
			const isOnce = memo.reminder.type === 'once';
			if (isOnce) {
				// One-time reminder: check date
				if (memo.reminder.date !== todayDate) return;
			} else {
				// Repeating reminder: check day of week
				if (!memo.reminder.days?.includes(today)) return;
			}

			// Trigger notification
			showNotification(memo);
			lastNotifiedMap[memo.id] = notifyKey;
			saveLastNotified();

			// Auto-open URL if enabled
			if (memo.url && memo.reminder.autoOpen) {
				window.open(memo.url, '_blank');
				memosStore.incrementOpenCount(memo.id);
			}

			// Disable one-time reminders after triggering
			if (isOnce) {
				memosStore.update(memo.id, {
					reminder: { ...memo.reminder, enabled: false }
				});
			}
		});
	}

	async function requestPermission(): Promise<boolean> {
		if (!('Notification' in window)) {
			console.warn('Notifications not supported');
			return false;
		}

		try {
			const result = await Notification.requestPermission();
			permission = result;
			return result === 'granted';
		} catch (e) {
			console.error('Failed to request notification permission:', e);
			return false;
		}
	}

	function showNotification(memo: Memo, isSnoozed = false): void {
		if (permission !== 'granted') return;

		if (permission !== 'granted') return;

		const title = isSnoozed ? `⏰ ${memo.title}` : memo.title;
		const options: NotificationOptions = {
			body: memo.content || '알림이 도착했습니다',
			icon: '/favicon.png',
			tag: memo.id,
			data: { memoId: memo.id, url: memo.url },
			requireInteraction: true
		};

		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.ready.then(registration => {
				registration.showNotification(title, options);
			});
		} else {
			const notification = new Notification(title, options);
			notification.onclick = () => {
				window.focus();
				if (memo.url && memo.reminder?.autoOpen) {
					window.open(memo.url, '_blank');
					memosStore.incrementOpenCount(memo.id);
				}
				notification.close();
			};
		}

	};
}
	}
	}

function getTodayReminders(): Memo[] {
	const today = new Date().getDay();
	const now = new Date();
	const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

	return memosStore.memos.filter((memo) => {
		if (!memo.reminder?.enabled) return false;
		if (!memo.reminder.days.includes(today)) return false;
		return true;
	}).sort((a, b) => {
		const timeA = a.reminder?.time || '00:00';
		const timeB = b.reminder?.time || '00:00';
		return timeA.localeCompare(timeB);
	});
}

function getUpcomingReminders(): Memo[] {
	const today = new Date().getDay();
	const now = new Date();
	const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

	return getTodayReminders().filter((memo) => {
		const reminderTime = memo.reminder?.time || '00:00';
		return reminderTime >= currentTime;
	});
}

function getPastReminders(): Memo[] {
	const now = new Date();
	const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

	return getTodayReminders().filter((memo) => {
		const reminderTime = memo.reminder?.time || '00:00';
		return reminderTime < currentTime;
	});
}

return {
	get permission() {
		return permission;
	},
	get initialized() {
		return initialized;
	},
	get snoozedReminders() {
		return snoozedReminders;
	},
	init,
	requestPermission,
	showNotification,
	getTodayReminders,
	getUpcomingReminders,
	getPastReminders,
	startBackgroundCheck,
	stopBackgroundCheck,
	checkAndTriggerReminders,
	snooze,
	cancelSnooze,
	getSnoozedUntil
};
}

export const notificationStore = createNotificationStore();
