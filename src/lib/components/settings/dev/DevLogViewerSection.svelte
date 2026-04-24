<script lang="ts">
	import { browser } from '$app/environment';
	import { cn } from '$lib/utils';
	import { devLogStore } from '$lib/stores/devLogs.svelte';
	import { FileText } from 'lucide-svelte';

	let logFilter = $state<'all' | 'Notification' | 'SW'>('all');
	let showLogViewer = $state(false);

	const filteredLogs = $derived.by(() => {
		const logs = devLogStore.logs;
		if (logFilter === 'all') return logs.slice(-100);
		return logs.filter((l) => l.source === logFilter).slice(-100);
	});

	$effect(() => {
		if (!browser) return;
		devLogStore.init();
	});
</script>

<!-- 앱 내 로그 뷰어 -->
<div class="space-y-2 pt-2 border-t border-border">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-semibold flex items-center gap-2">
			<FileText class="w-4 h-4" /> 알림 로그 뷰어
			<span class="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded">{devLogStore.logs.length}개</span>
		</h3>
		<div class="flex gap-2">
			<button onclick={() => (showLogViewer = !showLogViewer)} class="text-xs text-primary hover:underline">
				{showLogViewer ? '접기' : '펼치기'}
			</button>
			<button onclick={() => devLogStore.clear()} class="text-xs text-red-500 hover:underline">지우기</button>
		</div>
	</div>
	{#if showLogViewer}
		<div class="flex gap-1">
			{#each [['all', '전체'], ['Notification', 'Notification'], ['SW', 'SW']] as [val, label]}
				<button
					onclick={() => (logFilter = val as typeof logFilter)}
					class={cn(
						'text-xs px-2 py-1 rounded',
						logFilter === val ? 'bg-primary text-primary-foreground' : 'bg-muted'
					)}
				>
					{label}
				</button>
			{/each}
		</div>
		<div class="text-xs font-mono bg-black text-green-400 p-3 rounded-lg max-h-80 overflow-y-auto space-y-1">
			{#if filteredLogs.length === 0}
				<p class="text-gray-500">로그가 없습니다.</p>
			{:else}
				{#each filteredLogs.slice().reverse() as log}
					<div
						class={cn(
							'border-b border-gray-800 pb-1',
							log.level === 'error' && 'text-red-400',
							log.level === 'warn' && 'text-yellow-400',
							log.level === 'debug' && 'text-gray-500'
						)}
					>
						<span class="text-gray-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
						<span class="text-blue-400">[{log.source}]</span>
						{log.message}
						{#if log.data}<span class="text-gray-500">{JSON.stringify(log.data)}</span>{/if}
					</div>
				{/each}
			{/if}
		</div>
		<div class="text-xs text-muted-foreground">
			* 로그는 앱이 실행 중일 때만 기록됩니다. 백그라운드 SW 로그는 브라우저 개발자 도구에서 확인하세요.
		</div>
	{/if}
</div>

