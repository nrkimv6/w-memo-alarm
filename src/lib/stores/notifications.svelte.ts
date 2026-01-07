import type { Memo } from '$lib/types/memo';
import { memosStore } from './memos.svelte';

function createNotificationStore() {
	let permission = $state<NotificationPermission>('default');
	let initialized = $state(false);

	function init() {
		if (initialized || typeof window === 'undefined') return;

		if ('Notification' in window) {
			permission = Notification.permission;
		}
		initialized = true;
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

	function showNotification(memo: Memo): void {
		if (permission !== 'granted') return;

		const notification = new Notification(memo.title, {
			body: memo.content || '알림이 도착했습니다',
			icon: '/favicon.png',
			tag: memo.id,
			data: { memoId: memo.id, url: memo.url }
		});

		notification.onclick = () => {
			window.focus();
			if (memo.url && memo.reminder?.autoOpen) {
				window.open(memo.url, '_blank');
				memosStore.incrementOpenCount(memo.id);
			}
			notification.close();
		};
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
		init,
		requestPermission,
		showNotification,
		getTodayReminders,
		getUpcomingReminders,
		getPastReminders
	};
}

export const notificationStore = createNotificationStore();
