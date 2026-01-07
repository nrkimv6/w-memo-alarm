import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type LocalNotificationSchema, type ScheduleOptions } from '@capacitor/local-notifications';
import type { Memo } from '$lib/types/memo';

export function isNative(): boolean {
	return Capacitor.isNativePlatform();
}

export async function requestNotificationPermission(): Promise<boolean> {
	if (!isNative()) return false;

	try {
		const result = await LocalNotifications.requestPermissions();
		return result.display === 'granted';
	} catch (e) {
		console.error('Failed to request notification permission:', e);
		return false;
	}
}

export async function checkNotificationPermission(): Promise<boolean> {
	if (!isNative()) return false;

	try {
		const result = await LocalNotifications.checkPermissions();
		return result.display === 'granted';
	} catch (e) {
		return false;
	}
}

export async function scheduleNotification(memo: Memo): Promise<void> {
	if (!isNative() || !memo.reminder?.enabled) return;

	const { time, days } = memo.reminder;
	const [hours, minutes] = time.split(':').map(Number);

	// Cancel existing notifications for this memo
	await cancelNotification(memo.id);

	// Schedule notifications for each day
	const notifications: LocalNotificationSchema[] = [];

	for (const day of days) {
		const now = new Date();
		const scheduleDate = new Date();

		// Find the next occurrence of this day
		const daysUntil = (day - now.getDay() + 7) % 7;
		scheduleDate.setDate(now.getDate() + (daysUntil === 0 && (hours < now.getHours() || (hours === now.getHours() && minutes <= now.getMinutes())) ? 7 : daysUntil));
		scheduleDate.setHours(hours, minutes, 0, 0);

		notifications.push({
			id: generateNotificationId(memo.id, day),
			title: memo.title,
			body: memo.content || '알림이 도착했습니다',
			schedule: {
				at: scheduleDate,
				repeats: true,
				every: 'week'
			},
			extra: {
				memoId: memo.id,
				url: memo.url,
				autoOpen: memo.reminder.autoOpen
			}
		});
	}

	if (notifications.length > 0) {
		await LocalNotifications.schedule({ notifications });
	}
}

export async function cancelNotification(memoId: string): Promise<void> {
	if (!isNative()) return;

	try {
		const pending = await LocalNotifications.getPending();
		const toCancel = pending.notifications
			.filter((n) => n.extra?.memoId === memoId)
			.map((n) => ({ id: n.id }));

		if (toCancel.length > 0) {
			await LocalNotifications.cancel({ notifications: toCancel });
		}
	} catch (e) {
		console.error('Failed to cancel notification:', e);
	}
}

export async function cancelAllNotifications(): Promise<void> {
	if (!isNative()) return;

	try {
		const pending = await LocalNotifications.getPending();
		if (pending.notifications.length > 0) {
			await LocalNotifications.cancel({
				notifications: pending.notifications.map((n) => ({ id: n.id }))
			});
		}
	} catch (e) {
		console.error('Failed to cancel all notifications:', e);
	}
}

export function setupNotificationListeners(onNotificationClick: (memoId: string, url?: string) => void): void {
	if (!isNative()) return;

	LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
		const { memoId, url, autoOpen } = action.notification.extra || {};
		if (memoId) {
			onNotificationClick(memoId, autoOpen ? url : undefined);
		}
	});
}

function generateNotificationId(memoId: string, day: number): number {
	// Generate a consistent numeric ID from memoId and day
	let hash = 0;
	const str = `${memoId}-${day}`;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash);
}
