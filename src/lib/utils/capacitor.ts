import type { Memo } from '$lib/types/memo';
import { notificationHistoryStore } from '$lib/stores/notificationHistory.svelte';
import { extractUrlFromText } from './shareReceiver';

// 동적 import를 사용하여 Capacitor 모듈을 안전하게 로드
async function getCapacitor() {
	try {
		const { Capacitor } = await import('@capacitor/core');
		return Capacitor;
	} catch {
		return null;
	}
}

async function getApp() {
	try {
		const { App } = await import('@capacitor/app');
		return App;
	} catch {
		return null;
	}
}

async function getLocalNotifications() {
	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		return LocalNotifications;
	} catch {
		return null;
	}
}

export async function isNative(): Promise<boolean> {
	const Capacitor = await getCapacitor();
	return Capacitor?.isNativePlatform() ?? false;
}

export async function requestNotificationPermission(): Promise<boolean> {
	if (!(await isNative())) return false;

	try {
		const LocalNotifications = await getLocalNotifications();
		if (!LocalNotifications) return false;
		const result = await LocalNotifications.requestPermissions();
		return result.display === 'granted';
	} catch (e) {
		console.error('Failed to request notification permission:', e);
		return false;
	}
}

export async function checkNotificationPermission(): Promise<boolean> {
	if (!(await isNative())) return false;

	try {
		const LocalNotifications = await getLocalNotifications();
		if (!LocalNotifications) return false;
		const result = await LocalNotifications.checkPermissions();
		return result.display === 'granted';
	} catch (e) {
		return false;
	}
}

export async function scheduleNotification(memo: Memo): Promise<void> {
	if (!(await isNative()) || !memo.reminder?.enabled) return;

	const LocalNotifications = await getLocalNotifications();
	if (!LocalNotifications) return;

	const { time, days } = memo.reminder;
	const [hours, minutes] = time.split(':').map(Number);

	// Cancel existing notifications for this memo
	await cancelNotification(memo.id);

	// Schedule notifications for each day
	const notifications: Array<{
		id: number;
		title: string;
		body: string;
		schedule: { at: Date; repeats: boolean; every: 'week' };
		extra: { memoId: string; url?: string; autoOpen?: boolean };
	}> = [];

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
				every: 'week' as const
			},
			extra: {
				memoId: memo.id,
				url: memo.url,
				autoOpen: memo.reminder.autoOpen
			}
		});
	}

	if (notifications.length > 0) {
		try {
			await LocalNotifications.schedule({ notifications });
			notificationHistoryStore.addRecord({
				memoId: memo.id,
				memoTitle: memo.title,
				reminderId: memo.reminder?.id || '',
				reminderType: memo.reminder?.isDefault ? 'default' : 'additional',
				channel: 'capacitor-local',
				status: 'success',
				sentAt: new Date().toISOString()
			});
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : String(e);
			notificationHistoryStore.addRecord({
				memoId: memo.id,
				memoTitle: memo.title,
				reminderId: memo.reminder?.id || '',
				reminderType: memo.reminder?.isDefault ? 'default' : 'additional',
				channel: 'capacitor-local',
				status: 'failed',
				errorMessage: errorMsg,
				sentAt: new Date().toISOString()
			});
		}
	}
}

export async function cancelNotification(memoId: string): Promise<void> {
	if (!(await isNative())) return;

	try {
		const LocalNotifications = await getLocalNotifications();
		if (!LocalNotifications) return;
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
	if (!(await isNative())) return;

	try {
		const LocalNotifications = await getLocalNotifications();
		if (!LocalNotifications) return;
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

export async function setupNotificationListeners(onNotificationClick: (memoId: string, url?: string) => void): Promise<void> {
	if (!(await isNative())) return;

	const LocalNotifications = await getLocalNotifications();
	if (!LocalNotifications) return;

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

// ============================================
// Share Intent 수신 (Android)
// ============================================

export interface ShareIntentData {
	title?: string;
	text?: string;
	url?: string;
}

/**
 * Android Share Intent 리스너 설정
 * 다른 앱에서 공유된 텍스트/URL을 수신하여 /share 페이지로 리다이렉트
 */
export async function setupShareIntentListener(
	onShareReceived: (data: ShareIntentData) => void
): Promise<void> {
	if (!(await isNative())) return;

	const App = await getApp();
	if (!App) return;

	// appUrlOpen 이벤트 리스너 - Deep Link 및 Share Intent 처리
	App.addListener('appUrlOpen', (event) => {
		// Share Intent로부터 받은 데이터 처리
		// Android에서 SEND intent는 특수한 URL scheme으로 전달될 수 있음
		if (event.url.startsWith('intent://') || event.url.includes('share')) {
			// 실제 데이터는 getShareIntent로 가져옴
			checkPendingShareIntent(onShareReceived);
		}
	});

	// 앱 상태 변경 리스너 - 앱이 포그라운드로 올 때 share intent 확인
	App.addListener('appStateChange', (state) => {
		if (state.isActive) {
			checkPendingShareIntent(onShareReceived);
		}
	});

	// 앱 시작 시 pending share intent 확인
	checkPendingShareIntent(onShareReceived);
}

/**
 * 대기 중인 Share Intent 확인 및 처리
 * Android에서 앱이 share target으로 열렸을 때 intent extras에서 데이터 추출
 */
async function checkPendingShareIntent(
	onShareReceived: (data: ShareIntentData) => void
): Promise<void> {
	if (!(await isNative())) return;

	try {
		const App = await getApp();
		if (!App) return;

		// Capacitor App 플러그인의 getLaunchUrl로 앱 시작 URL 확인
		const launchUrl = await App.getLaunchUrl();

		if (launchUrl?.url) {
			const parsed = parseShareIntentUrl(launchUrl.url);
			if (parsed) {
				onShareReceived(parsed);
			}
		}
	} catch (e) {
		console.error('[Capacitor] checkPendingShareIntent error:', e);
	}
}

/**
 * Share Intent URL 파싱
 * Android에서 공유 시 전달되는 데이터 형식 처리
 */
function parseShareIntentUrl(url: string): ShareIntentData | null {
	try {
		// URL scheme 형태로 전달된 경우
		if (url.startsWith('com.woory.memoalarm://share')) {
			const urlObj = new URL(url.replace('com.woory.memoalarm://', 'https://app/'));
			const params = urlObj.searchParams;

			return {
				title: params.get('title') || undefined,
				text: params.get('text') || undefined,
				url: params.get('url') || undefined
			};
		}

		// text/plain 공유의 경우 URL 자체가 공유 텍스트일 수 있음
		if (url && !url.startsWith('com.woory.memoalarm://')) {
			const { url: extractedUrl, cleanText } = extractUrlFromText(url);
			return {
				text: cleanText || url,
				url: extractedUrl
			};
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Share Intent 데이터를 URL 쿼리 파라미터로 변환
 */
export function shareIntentToQueryParams(data: ShareIntentData): string {
	const params = new URLSearchParams();

	if (data.title) params.set('title', data.title);
	if (data.text) params.set('text', data.text);
	if (data.url) params.set('url', data.url);

	return params.toString();
}
