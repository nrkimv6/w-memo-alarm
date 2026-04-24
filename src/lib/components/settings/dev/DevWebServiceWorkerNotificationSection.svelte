<script lang="ts">
	import { browser } from '$app/environment';
	import Button from '$lib/components/ui/Button.svelte';
	import { SW_MSG } from '$lib/constants/swMessages';
	import { Bell, CheckCircle, XCircle } from 'lucide-svelte';

	let webPushTestSent = $state(false);
	let webPushDelayedSent = $state(false);
	let swRegistration = $state<ServiceWorkerRegistration | null>(null);
	let testDelaySeconds = $state(5);

	$effect(() => {
		if (!browser) return;
		checkServiceWorker();
	});

	async function checkServiceWorker() {
		if ('serviceWorker' in navigator) {
			swRegistration = await navigator.serviceWorker.ready;
		}
	}

	async function testWebPushNotification() {
		webPushTestSent = false;
		if (!('serviceWorker' in navigator)) {
			alert('이 브라우저는 Service Worker를 지원하지 않습니다.');
			return;
		}
		if (Notification.permission !== 'granted') {
			const result = await Notification.requestPermission();
			if (result !== 'granted') {
				alert('알림 권한이 필요합니다.');
				return;
			}
		}
		try {
			const registration = await navigator.serviceWorker.ready;
			registration.active?.postMessage({
				type: SW_MSG.TEST_NOTIFICATION,
				title: '웹 푸시 테스트',
				body: 'Service Worker에서 직접 보낸 알림입니다!'
			});
			webPushTestSent = true;
		} catch (e) {
			alert('테스트 실패: ' + (e as Error).message);
		}
	}

	async function testDelayedWebPushNotification() {
		webPushDelayedSent = false;
		if (!('serviceWorker' in navigator)) {
			alert('이 브라우저는 Service Worker를 지원하지 않습니다.');
			return;
		}
		if (Notification.permission !== 'granted') {
			const result = await Notification.requestPermission();
			if (result !== 'granted') {
				alert('알림 권한이 필요합니다.');
				return;
			}
		}
		try {
			const registration = await navigator.serviceWorker.ready;
			registration.active?.postMessage({
				type: SW_MSG.DELAYED_NOTIFICATION,
				delay: testDelaySeconds * 1000,
				title: '백그라운드 알림 테스트',
				body: `${testDelaySeconds}초 후 알림! 앱을 백그라운드로 보내도 이 알림이 표시되어야 합니다.`
			});
			webPushDelayedSent = true;
			alert(`${testDelaySeconds}초 후 알림이 예약되었습니다.\n\n지금 탭을 최소화하거나 다른 앱으로 전환해보세요!`);
		} catch (e) {
			alert('테스트 실패: ' + (e as Error).message);
		}
	}
</script>

<!-- 웹 Service Worker 알림 테스트 -->
<div class="space-y-2 pt-2 border-t border-border">
	<h3 class="text-sm font-semibold flex items-center gap-2">
		<Bell class="w-4 h-4" /> 웹 Service Worker 알림
		{#if swRegistration}
			<span class="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">SW 활성</span>
		{:else}
			<span class="text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded">SW 없음</span>
		{/if}
	</h3>
	<div class="text-xs text-muted-foreground space-y-1">
		<p>Service Worker 상태: {swRegistration ? '등록됨' : '미등록'}</p>
		<p>
			Notification 권한:
			<span class="font-mono">{typeof Notification !== 'undefined' ? Notification.permission : 'N/A'}</span>
		</p>
	</div>
	<div class="space-y-2">
		<Button variant="default" size="sm" onclick={testWebPushNotification} class="w-full">
			즉시 알림 테스트 (Service Worker)
		</Button>
		{#if webPushTestSent}
			<p class="text-xs text-green-500 flex items-center gap-1">
				<CheckCircle class="w-3 h-3" /> 테스트 알림이 발송되었습니다!
			</p>
		{/if}
		<div class="flex gap-2">
			<select
				bind:value={testDelaySeconds}
				class="flex-shrink-0 px-2 py-1.5 text-sm rounded-md border border-input bg-background"
			>
				<option value={5}>5초</option><option value={10}>10초</option>
				<option value={30}>30초</option><option value={60}>1분</option>
				<option value={120}>2분</option>
			</select>
			<Button variant="secondary" size="sm" onclick={testDelayedWebPushNotification} class="flex-1">
				백그라운드 알림 테스트
			</Button>
		</div>
		{#if webPushDelayedSent}
			<p class="text-xs text-green-500 flex items-center gap-1">
				<CheckCircle class="w-3 h-3" /> {testDelaySeconds}초 후 알림 예약됨! 탭을 백그라운드로 보내세요.
			</p>
		{/if}
		<div class="text-xs text-blue-600 bg-blue-500/10 p-2 rounded space-y-1">
			<p class="font-semibold">테스트 방법:</p>
			<ol class="list-decimal list-inside space-y-0.5">
				<li>시간을 선택하고 "백그라운드 알림 테스트" 클릭</li>
				<li>즉시 탭을 최소화하거나 다른 앱으로 전환</li>
				<li>설정한 시간 후 알림이 오면 성공!</li>
			</ol>
			<p class="mt-2 text-yellow-600">※ 브라우저를 완전히 닫으면 안 됩니다. 탭이 열려있어야 합니다.</p>
		</div>
	</div>
</div>

