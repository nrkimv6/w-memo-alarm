// Firebase Cloud Messaging Service Worker (웹/PWA)
// 백그라운드 알림 수신

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// memo-alarm service worker — wservice-cross-noti 프로젝트 전용
firebase.initializeApp({
	apiKey: 'AIzaSyAVh8Enn3VjbLo4JMBmvhK5zE2nZJvMzDA',
	authDomain: 'wservice-cross-noti.firebaseapp.com',
	projectId: 'wservice-cross-noti',
	storageBucket: 'wservice-cross-noti.firebasestorage.app',
	messagingSenderId: '570337797776',
	appId: '1:570337797776:web:dd0e36c66152ad18275a15'
});

const messaging = firebase.messaging();

// 백그라운드 메시지 핸들러
messaging.onBackgroundMessage((payload) => {
	console.log('[firebase-messaging-sw.js] Background message received:', payload);

	const notificationTitle = payload.notification?.title || 'memo-alarm';
	const notificationOptions = {
		body: payload.notification?.body || '',
		icon: '/favicon.png',
		tag: 'memo-alarm-notification',
		requireInteraction: false,
		data: payload.data
	};

	return self.registration.showNotification(notificationTitle, notificationOptions);
});

// 알림 클릭 핸들러
self.addEventListener('notificationclick', (event) => {
	console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);

	event.notification.close();

	// 알림 데이터에서 메모 ID 추출
	const memoId = event.notification.data?.memoId;
	const appUrl = memoId ? `/?memo=${memoId}` : '/';

	// 알림 클릭 시 앱 열기
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// 이미 열린 창이 있으면 포커스 후 네비게이트
			for (const client of clientList) {
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					return client.focus().then((focusedClient) => {
						return focusedClient.navigate(appUrl).catch(() => clients.openWindow(appUrl));
					});
				}
			}

			// 열린 창이 없으면 새 창 열기
			return clients.openWindow(appUrl);
		})
	);
});
