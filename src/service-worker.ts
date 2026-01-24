/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = `memo-alarm-${version}`;

const ASSETS = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => {
			sw.skipWaiting();
		})
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			for (const key of keys) {
				if (key !== CACHE_NAME) {
					await caches.delete(key);
				}
			}
			sw.clients.claim();
		})
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// 같은 origin만 캐시
	if (url.origin !== location.origin) return;

	// API 요청은 캐시하지 않음
	if (url.pathname.startsWith('/api')) return;

	event.respondWith(
		caches.open(CACHE_NAME).then(async (cache) => {
			const cachedResponse = await cache.match(event.request);

			if (cachedResponse) {
				return cachedResponse;
			}

			const response = await fetch(event.request);

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		})
	);
});

// Push 이벤트 수신 (VAPID Web Push)
sw.addEventListener('push', (event) => {
	const data = event.data?.json() ?? {
		title: '메모 알람',
		body: '알림이 있습니다'
	};

	event.waitUntil(
		sw.registration.showNotification(data.title, {
			body: data.body,
			icon: '/favicon.png',
			badge: '/favicon.png',
			tag: data.tag || 'memo-reminder',
			data: { url: data.url || '/', memoId: data.memoId },
			vibrate: [200, 100, 200],
			requireInteraction: true
		})
	);
});

// 메시지 수신 (캐시 업데이트 및 테스트용)
sw.addEventListener('message', (event) => {
	if (event.data.type === 'SKIP_WAITING') {
		console.log('[SW] SKIP_WAITING received, activating immediately');
		sw.skipWaiting();
	}

	// 테스트 알림 (즉시)
	if (event.data.type === 'TEST_NOTIFICATION') {
		console.log('[SW] TEST_NOTIFICATION received');
		sw.registration.showNotification(event.data.title || '테스트 알림', {
			body: event.data.body || '서비스 워커에서 보낸 테스트 알림입니다.',
			icon: '/favicon.png',
			badge: '/favicon.png',
			tag: 'test-notification',
			data: { url: '/', isTest: true },
			vibrate: [200, 100, 200],
			requireInteraction: true
		});
	}

	// 지연 알림 테스트 (백그라운드 테스트용)
	if (event.data.type === 'DELAYED_NOTIFICATION') {
		const delay = event.data.delay || 5000;
		console.log(`[SW] DELAYED_NOTIFICATION received, will fire in ${delay}ms`);

		setTimeout(() => {
			sw.registration.showNotification(event.data.title || '백그라운드 알림 테스트', {
				body: event.data.body || `${delay / 1000}초 후 알림이 도착했습니다! 앱이 백그라운드에 있어도 작동합니다.`,
				icon: '/favicon.png',
				badge: '/favicon.png',
				tag: 'delayed-test-notification',
				data: { url: '/', isTest: true, delayed: true },
				vibrate: [200, 100, 200, 100, 200],
				requireInteraction: true
			});
		}, delay);
	}
});

// 알림 클릭
sw.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const url = event.notification.data?.url || '/';

	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// 이미 열린 창이 있으면 포커스
			for (const client of clientList) {
				if (client.url.includes(sw.location.origin) && 'focus' in client) {
					(client as WindowClient).focus();
					(client as WindowClient).navigate(url);
					return;
				}
			}
			// 없으면 새 창 열기
			return sw.clients.openWindow(url);
		})
	);
});
