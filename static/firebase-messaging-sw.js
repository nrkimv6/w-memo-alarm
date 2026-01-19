// Firebase Cloud Messaging Service Worker (웹/PWA)
// 백그라운드 알림 수신

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase 설정 (line-minder와 동일한 프로젝트)
firebase.initializeApp({
	apiKey: 'AIzaSyA7D62gSqecQ-gUMUJ8C-P-0Fs6CeybyK4',
	authDomain: 'lineminder-23489.firebaseapp.com',
	projectId: 'lineminder-23489',
	storageBucket: 'lineminder-23489.appspot.com',
	messagingSenderId: '426056584594',
	appId: '1:426056584594:web:5ecf5d11afe3e2c8a5854b'
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

	// 알림 클릭 시 앱 열기
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// 이미 열린 창이 있으면 포커스
			for (const client of clientList) {
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					return client.focus();
				}
			}

			// 열린 창이 없으면 새 창 열기
			if (clients.openWindow) {
				const url = memoId ? `/?memo=${memoId}` : '/';
				return clients.openWindow(url);
			}
		})
	);
});
