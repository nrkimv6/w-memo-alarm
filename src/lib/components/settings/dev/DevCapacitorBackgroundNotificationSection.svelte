<script lang="ts">
	import { browser } from '$app/environment';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		isNative,
		requestNotificationPermission as requestNativePermission,
		checkNotificationPermission as checkNativePermission,
		cancelAllNotifications
	} from '$lib/utils/capacitor';
	import { Bell, CheckCircle, Trash2 } from 'lucide-svelte';

	let isNativePlatform = $state(false);
	let nativePermission = $state<string>('확인 중...');
	let pendingNotifications = $state<string[]>([]);
	let capacitorTestScheduled = $state(false);
	let testDelaySeconds = $state(5);

	$effect(() => {
		if (!browser) return;
		checkCapacitorStatus();
	});

	async function checkCapacitorStatus() {
		isNativePlatform = await isNative();
		if (isNativePlatform) {
			const hasPermission = await checkNativePermission();
			nativePermission = hasPermission ? 'granted' : 'denied';
			await loadPendingNotifications();
		} else {
			nativePermission = 'N/A (웹 환경)';
		}
	}

	async function loadPendingNotifications() {
		if (!isNativePlatform) return;
		try {
			const { LocalNotifications } = await import('@capacitor/local-notifications');
			const pending = await LocalNotifications.getPending();
			pendingNotifications = pending.notifications.map(
				(n) =>
					`[${n.id}] ${n.title} - ${n.schedule?.at ? new Date(n.schedule.at).toLocaleString() : '시간 없음'}`
			);
		} catch {
			pendingNotifications = ['로드 실패'];
		}
	}

	async function requestNativeNotificationPermission() {
		const granted = await requestNativePermission();
		nativePermission = granted ? 'granted' : 'denied';
	}

	async function testCapacitorNotification() {
		capacitorTestScheduled = false;
		if (!isNativePlatform) {
			alert('네이티브 앱에서만 사용 가능합니다.');
			return;
		}
		try {
			const { LocalNotifications } = await import('@capacitor/local-notifications');
			const permission = await LocalNotifications.checkPermissions();
			if (permission.display !== 'granted') {
				const req = await LocalNotifications.requestPermissions();
				if (req.display !== 'granted') {
					alert('알림 권한이 필요합니다.');
					return;
				}
			}
			const scheduleTime = new Date(Date.now() + testDelaySeconds * 1000);
			await LocalNotifications.schedule({
				notifications: [
					{
						id: 99999,
						title: '테스트 백그라운드 알림',
						body: `${testDelaySeconds}초 후 알림이 정상 작동합니다! 앱을 닫아도 이 알림이 표시되어야 합니다.`,
						schedule: { at: scheduleTime },
						extra: { memoId: 'test', isTest: true }
					}
				]
			});
			capacitorTestScheduled = true;
			await loadPendingNotifications();
			alert(
				`테스트 알림이 ${scheduleTime.toLocaleTimeString()}에 예약되었습니다.\n\n앱을 백그라운드로 보내거나 닫아도 알림이 와야 합니다.`
			);
		} catch (e) {
			alert('테스트 실패: ' + (e as Error).message);
		}
	}

	async function clearAllScheduledNotifications() {
		if (!isNativePlatform) return;
		try {
			await cancelAllNotifications();
			await loadPendingNotifications();
			alert('모든 예약된 알림이 취소되었습니다.');
		} catch (e) {
			alert('취소 실패: ' + (e as Error).message);
		}
	}
</script>

<!-- Capacitor 백그라운드 알림 -->
<div class="space-y-2 pt-2 border-t border-border">
	<h3 class="text-sm font-semibold flex items-center gap-2">
		<Bell class="w-4 h-4" /> Capacitor 백그라운드 알림
		{#if isNativePlatform}
			<span class="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">네이티브</span>
		{:else}
			<span class="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">웹</span>
		{/if}
	</h3>
	<div class="text-xs text-muted-foreground space-y-1">
		<p>플랫폼: {isNativePlatform ? '네이티브 앱' : '웹 브라우저'}</p>
		<p>
			네이티브 알림 권한: <span class="font-mono">{nativePermission}</span>
		</p>
	</div>
	{#if isNativePlatform}
		{#if nativePermission !== 'granted'}
			<Button variant="secondary" size="sm" onclick={requestNativeNotificationPermission} class="w-full">
				네이티브 알림 권한 요청
			</Button>
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
			<Button variant="default" onclick={testCapacitorNotification} class="flex-1">백그라운드 알림 테스트</Button>
		</div>
		{#if capacitorTestScheduled}
			<p class="text-xs text-green-500 flex items-center gap-1">
				<CheckCircle class="w-3 h-3" /> {testDelaySeconds}초 후 테스트 알림이 예약됨! 앱을 닫아보세요.
			</p>
		{/if}
		<div class="space-y-1 mt-2">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold">예약된 알림 ({pendingNotifications.length}개)</span>
				<button onclick={loadPendingNotifications} class="text-xs text-primary hover:underline">새로고침</button>
			</div>
			{#if pendingNotifications.length > 0}
				<div class="text-xs font-mono bg-muted p-2 rounded max-h-32 overflow-y-auto space-y-1">
					{#each pendingNotifications as notification}<p class="truncate">{notification}</p>{/each}
				</div>
				<Button variant="destructive" size="sm" onclick={clearAllScheduledNotifications} class="w-full">
					<Trash2 class="w-3 h-3" /> 모든 예약 알림 취소
				</Button>
			{:else}
				<p class="text-xs text-muted-foreground">예약된 알림이 없습니다.</p>
			{/if}
		</div>
	{:else}
		<p class="text-xs text-yellow-600 bg-yellow-500/10 p-2 rounded">
			Capacitor 백그라운드 알림은 안드로이드 앱에서만 작동합니다. 웹 환경에서는 아래 "웹 Service Worker 알림"
			테스트를 사용하세요.
		</p>
	{/if}
</div>

