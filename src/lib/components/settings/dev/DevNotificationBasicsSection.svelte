<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import { BellRing, CheckCircle, XCircle } from 'lucide-svelte';

	let testNotificationSent = $state(false);

	async function testNotification() {
		testNotificationSent = false;
		if (notificationStore.permission !== 'granted') {
			const granted = await notificationStore.requestPermission();
			if (!granted) {
				alert('알림 권한이 필요합니다. 브라우저 설정에서 알림을 허용해주세요.');
				return;
			}
		}
		try {
			const testMemo = {
				id: 'test-notification',
				title: '테스트 알림',
				content: '알림이 정상적으로 작동합니다!',
				url: '',
				reminder: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};
			// @ts-ignore
			notificationStore.showNotification(testMemo);
			testNotificationSent = true;
		} catch (error) {
			alert('알림 발송에 실패했습니다: ' + (error as Error).message);
		}
	}

	function triggerManualCheck() {
		notificationStore.checkAndTriggerReminders();
		alert('알림 체크가 수동으로 실행되었습니다.');
	}
</script>

<!-- 알림 권한 상태 -->
<div class="space-y-2">
	<h3 class="text-sm font-semibold flex items-center gap-2">
		알림 권한 상태
		{#if notificationStore.permission === 'granted'}
			<CheckCircle class="w-4 h-4 text-green-500" />
		{:else if notificationStore.permission === 'denied'}
			<XCircle class="w-4 h-4 text-red-500" />
		{:else}
			<XCircle class="w-4 h-4 text-yellow-500" />
		{/if}
	</h3>
	<p class="text-xs text-muted-foreground">
		현재 상태: <span class="font-mono">{notificationStore.permission}</span>
	</p>
	{#if notificationStore.permission !== 'granted'}
		<Button variant="secondary" size="sm" onclick={() => notificationStore.requestPermission()} class="w-full">
			알림 권한 요청
		</Button>
	{/if}
</div>

<!-- 테스트 알림 -->
<div class="space-y-2 pt-2 border-t border-border">
	<h3 class="text-sm font-semibold flex items-center gap-2">
		<BellRing class="w-4 h-4" /> 알림 테스트
	</h3>
	<Button variant="default" onclick={testNotification} class="w-full">테스트 알림 보내기</Button>
	{#if testNotificationSent}
		<p class="text-xs text-green-500 flex items-center gap-1">
			<CheckCircle class="w-3 h-3" /> 테스트 알림이 발송되었습니다!
		</p>
	{/if}
</div>

<!-- 수동 알림 체크 -->
<div class="space-y-2 pt-2 border-t border-border">
	<h3 class="text-sm font-semibold">수동 알림 체크</h3>
	<p class="text-xs text-muted-foreground">현재 시간에 맞는 알림이 있는지 수동으로 체크합니다.</p>
	<Button variant="secondary" onclick={triggerManualCheck} class="w-full">알림 체크 실행</Button>
</div>

