// VAPID Web Push 유틸리티
// 브라우저 푸시 구독 및 D1 저장

const VAPID_PUBLIC_KEY = import.meta.env.PUBLIC_VAPID_PUBLIC_KEY;
const PUSH_ENABLED_KEY = 'memo-alarm:webPushEnabled';

// Base64 URL → Uint8Array 변환
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// 푸시 구독 상태 확인
export async function isPushSubscribed(): Promise<boolean> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
		return false;
	}

	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();
		return !!subscription;
	} catch (e) {
		console.error('[Push] 구독 상태 확인 실패:', e);
		return false;
	}
}

// 푸시 구독
export async function subscribeToPush(
	alarmTime: string = '09:00',
	notifyDays: number[] = [0, 1, 2, 3, 4, 5, 6]
): Promise<boolean> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
		console.warn('[Push] 미지원 브라우저');
		return false;
	}

	if (!VAPID_PUBLIC_KEY) {
		console.error('[Push] VAPID_PUBLIC_KEY가 설정되지 않음');
		return false;
	}

	try {
		const registration = await navigator.serviceWorker.ready;

		// 기존 구독 확인
		let subscription = await registration.pushManager.getSubscription();

		if (!subscription) {
			// 새 구독 생성
			subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
			});
		}

		// D1에 저장
		const saved = await savePushSubscription(subscription, alarmTime, notifyDays);
		if (!saved) {
			console.error('[Push] 구독 정보 저장 실패');
			return false;
		}

		savePushSetting(true);
		console.log('[Push] 구독 성공');
		return true;
	} catch (e) {
		console.error('[Push] 구독 실패:', e);
		return false;
	}
}

// 구독 정보 D1에 저장
async function savePushSubscription(
	subscription: PushSubscription,
	alarmTime: string,
	notifyDays: number[]
): Promise<boolean> {
	try {
		const json = subscription.toJSON();
		const response = await fetch('/api/sync', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'subscribe_push',
				subscription: {
					endpoint: json.endpoint,
					p256dh: json.keys?.p256dh,
					auth: json.keys?.auth,
					alarm_time: alarmTime,
					notify_days: notifyDays,
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
				}
			})
		});

		if (!response.ok) {
			console.error('[Push] DB 저장 실패:', await response.text());
			return false;
		}

		return true;
	} catch (e) {
		console.error('[Push] 저장 중 오류:', e);
		return false;
	}
}

// 구독 설정 업데이트 (시간, 요일만)
export async function updatePushSubscriptionSettings(
	alarmTime: string,
	notifyDays: number[]
): Promise<boolean> {
	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();

		if (!subscription) {
			return false;
		}

		const response = await fetch('/api/sync', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'update_push_settings',
				endpoint: subscription.endpoint,
				alarm_time: alarmTime,
				notify_days: notifyDays,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
			})
		});

		return response.ok;
	} catch (e) {
		console.error('[Push] 설정 업데이트 실패:', e);
		return false;
	}
}

// 푸시 구독 해제
export async function unsubscribeFromPush(): Promise<boolean> {
	try {
		const registration = await navigator.serviceWorker.ready;
		const subscription = await registration.pushManager.getSubscription();

		if (subscription) {
			// D1에서 삭제
			await fetch('/api/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'unsubscribe_push',
					endpoint: subscription.endpoint
				})
			});

			// 브라우저 구독 해제
			await subscription.unsubscribe();
		}

		savePushSetting(false);
		return true;
	} catch (e) {
		console.error('[Push] 구독 해제 실패:', e);
		return false;
	}
}

// 로컬 설정 저장/불러오기
export function savePushSetting(enabled: boolean): void {
	localStorage.setItem(PUSH_ENABLED_KEY, String(enabled));
}

export function loadPushSetting(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(PUSH_ENABLED_KEY) === 'true';
}
