// Firebase Cloud Messaging Service Worker (웹/PWA)
// 백그라운드 알림 수신

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// SW 업데이트 시 즉시 활성화 — waiting 상태에서 멈추지 않도록
self.addEventListener('install', (event) => {
	self.skipWaiting();
});
self.addEventListener('activate', (event) => {
	event.waitUntil(clients.claim());
});

// memo-alarm service worker — wservice-cross-noti 프로젝트 전용
//
// ⚠️  Secret boundary 확인 (2026-06-09)
// 아래 값은 모두 FCM Web Client public config다.
//   - apiKey: Firebase Web API key (FCM 등록·메시징 전용, 클라이언트 측 식별자)
//   - appId, messagingSenderId, projectId 등: Firebase 프로젝트 공개 식별자
// 이 값들은 Firebase console > Project settings > General > Your apps에서 확인 가능하며,
// 브라우저 JS에 노출되어도 무방한 공개 설정이다. Firebase 접근 제어는 Firestore Rules와
// Firebase Auth로 수행되며, 이 키만으로는 서버 자원에 접근할 수 없다.
//
// ❌ server credential은 이 파일에 없음 (Firebase Admin SDK key, GCP service account 등
//    은 절대 client bundle / service worker에 포함하지 않는다).
//
// Service Worker는 import.meta.env를 지원하지 않으므로 값이 직접 인라인되어 있다.
// 환경별 분기가 필요해지면 SW 빌드 시 Vite 플러그인 주입 방식으로 전환한다.
// 참고: docs/plan/secret-manager-boundary.md
firebase.initializeApp({
	apiKey: 'AIzaSyAVh8Enn3VjbLo4JMBmvhK5zE2nZJvMzDA',
	authDomain: 'wservice-cross-noti.firebaseapp.com',
	projectId: 'wservice-cross-noti',
	storageBucket: 'wservice-cross-noti.firebasestorage.app',
	messagingSenderId: '570337797776',
	appId: '1:570337797776:web:dd0e36c66152ad18275a15'
});

const messaging = firebase.messaging();

// 동일 분에 도착하는 FCM push를 모아 병합 알림으로 표시하기 위한 buffer/timer
// _fcmPendingResolves: 각 push handler의 Promise.resolve를 모아 flush 시 일괄 해제 (SW keepalive 보장)
let _fcmPending = [];
let _fcmMergeTimer = null;
let _fcmPendingResolves = [];

// 버퍼에 쌓인 payload를 꺼내 단일/병합 알림으로 표시하고 모든 handler Promise를 resolve
function _flushFcmNotifications() {
	try {
		const items = _fcmPending.splice(0, _fcmPending.length);
		_fcmPending = [];
		_fcmMergeTimer = null;

		if (items.length === 0) return;

		if (items.length === 1) {
			const payload = items[0];
			const scheduleId = payload.data?.schedule_id || String(Date.now());
			const title = payload.notification?.title || 'memo-alarm';
			const body = payload.notification?.body || '';
			self.registration.showNotification(title, {
				body,
				icon: '/favicon.png',
				tag: 'memo-alarm-' + scheduleId,
				requireInteraction: false,
				data: {
					memo_id: payload.data?.memo_id,
					memoId: payload.data?.memoId,
					type: 'single'
				}
			});
		} else {
			const mergeKey = items[0].data?.schedule_id || String(Date.now());
			const titleLines = items.map((p) => '• ' + (p.notification?.title || 'memo-alarm'));
			const memoIds = items.map((p) => p.data?.memo_id || p.data?.memoId).filter(Boolean);
			self.registration.showNotification(items.length + '개의 메모 알림', {
				body: titleLines.join('\n'),
				icon: '/favicon.png',
				tag: 'memo-alarm-merged-' + mergeKey,
				requireInteraction: false,
				data: { memoIds, type: 'merged' }
			});
		}
	} catch (e) {
		console.error('[firebase-messaging-sw.js] flush error:', e);
	} finally {
		// 모든 handler Promise resolve — flush 실패해도 SW keepalive가 무한 지속되지 않도록
		const resolves = _fcmPendingResolves.splice(0, _fcmPendingResolves.length);
		_fcmPendingResolves = [];
		resolves.forEach((r) => r());
	}
}

// 백그라운드 메시지 핸들러 — 800ms debounce 병합 window
// 각 handler는 _fcmPendingResolves에 resolve를 등록, flush 시 일괄 해제
messaging.onBackgroundMessage((payload) => {
	console.log('[firebase-messaging-sw.js] Background message received:', payload);
	_fcmPending.push(payload);
	clearTimeout(_fcmMergeTimer);
	return new Promise((resolve) => {
		_fcmPendingResolves.push(resolve);
		_fcmMergeTimer = setTimeout(_flushFcmNotifications, 800);
	});
});

// 알림 클릭 핸들러
self.addEventListener('notificationclick', (event) => {
	console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);

	event.notification.close();

	const data = event.notification.data || {};
	let appUrl;
	if (data.type === 'merged') {
		const firstId = data.memoIds?.[0] || data.memo_ids?.[0];
		appUrl = firstId ? '/?memo=' + firstId : '/';
	} else {
		const memoId = data.memo_id || data.memoId;
		appUrl = memoId ? '/?memo=' + memoId : '/';
	}

	// 알림 클릭 시 앱 열기
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// 이미 열린 창이 있으면 포커스 후 네비게이트
			// scope가 /firebase-messaging/로 제한되어 root 문서를 control하지 않으므로
			// navigate()가 null을 반환할 수 있다 — null 반환 시 openWindow 폴백
			for (const client of clientList) {
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					return client.focus().then((focusedClient) => {
						return focusedClient.navigate(appUrl).then((result) => {
							if (!result) return clients.openWindow(appUrl);
						}).catch(() => clients.openWindow(appUrl));
					});
				}
			}

			// 열린 창이 없으면 새 창 열기
			return clients.openWindow(appUrl);
		})
	);
});
