<script lang="ts">
	import { browser } from '$app/environment';
	import Button from '$lib/components/ui/Button.svelte';
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import { Bell } from 'lucide-svelte';

	let swScheduleStatus = $state<{
		reminders: Array<{ memoId: string; title: string; time: string; type: string }>;
		intervalRunning: boolean;
		loading: boolean;
		error: string | null;
	}>({
		reminders: [],
		intervalRunning: false,
		loading: false,
		error: null
	});

	$effect(() => {
		if (!browser) return;
		checkSWScheduleStatus();
	});

	async function checkSWScheduleStatus() {
		swScheduleStatus.loading = true;
		swScheduleStatus.error = null;
		try {
			const status = await notificationStore.getServiceWorkerScheduleStatus();
			if (status) {
				swScheduleStatus.reminders = status.reminders as any[];
				swScheduleStatus.intervalRunning = status.intervalRunning;
			} else {
				swScheduleStatus.error = 'SW 응답 없음';
			}
		} catch (error) {
			swScheduleStatus.error = (error as Error).message;
		} finally {
			swScheduleStatus.loading = false;
		}
	}

	async function registerRemindersToSW() {
		await notificationStore.registerRemindersToServiceWorker();
		await checkSWScheduleStatus();
		alert('Service Worker에 알림 스케줄이 등록되었습니다. 콘솔에서 로그를 확인하세요.');
	}
</script>

<!-- SW 메모 알림 스케줄 상태 -->
<div class="space-y-2 pt-2 border-t border-border">
	<h3 class="text-sm font-semibold flex items-center gap-2">
		<Bell class="w-4 h-4" /> SW 메모 알림 스케줄
		{#if swScheduleStatus.intervalRunning}
			<span class="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">체크 중</span>
		{:else}
			<span class="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">대기</span>
		{/if}
		<button onclick={checkSWScheduleStatus} class="ml-auto text-xs text-primary hover:underline">새로고침</button>
	</h3>
	{#if swScheduleStatus.loading}
		<p class="text-xs text-muted-foreground">로딩 중...</p>
	{:else if swScheduleStatus.error}
		<p class="text-xs text-red-500">{swScheduleStatus.error}</p>
	{:else}
		<div class="text-xs space-y-1 p-2 rounded bg-muted">
			<p class="font-semibold">등록된 알림: {swScheduleStatus.reminders.length}개</p>
			<p>Interval 실행 중: {swScheduleStatus.intervalRunning ? '예' : '아니오'}</p>
		</div>
		{#if swScheduleStatus.reminders.length > 0}
			<div class="text-xs font-mono bg-muted p-2 rounded max-h-40 overflow-y-auto space-y-1">
				{#each swScheduleStatus.reminders as reminder}
					<p class="truncate border-b border-border/50 pb-1">
						[{reminder.time}] {reminder.title} <span class="text-muted-foreground">({reminder.type})</span>
					</p>
				{/each}
			</div>
		{:else}
			<p class="text-xs text-muted-foreground">Service Worker에 등록된 알림이 없습니다.</p>
		{/if}
		<Button variant="default" size="sm" onclick={registerRemindersToSW} class="w-full">SW에 알림 스케줄 등록</Button>
		<div class="text-xs text-orange-600 bg-orange-500/10 p-2 rounded space-y-1">
			<p class="font-semibold">⚠️ 문제 원인:</p>
			<p>현재 메모 알림은 메인 스레드의 setInterval로 체크됩니다. 앱이 백그라운드로 가면 setInterval이 멈추므로 알림이 안 뜹니다.</p>
			<p class="mt-1 text-green-600 font-semibold">✅ 해결 방법:</p>
			<p>위 버튼을 눌러 Service Worker에 알림 스케줄을 등록하면 SW에서 매분 체크하여 백그라운드에서도 알림이 작동합니다.</p>
		</div>
	{/if}
</div>

