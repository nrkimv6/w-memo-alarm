<script lang="ts">
	import { goto } from '$app/navigation';
	import { CheckCircle, XCircle, HelpCircle, ChevronDown } from 'lucide-svelte';
	import type { NotificationHistory } from '$lib/types/memo';

	let { record }: { record: NotificationHistory } = $props();

	let showError = $state(false);

	function formatTime(sentAt: string): string {
		const date = new Date(sentAt);
		return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
	}

	function getChannelLabel(channel: string): string {
		switch (channel) {
			case 'sw-push': return 'Push';
			case 'capacitor-local': return 'Native';
			case 'fcm-push': return 'FCM';
			default: return channel;
		}
	}

	function handleClick() {
		goto('/memos');
	}
</script>

<button
	onclick={handleClick}
	class="w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left
		{record.status === 'failed'
			? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30'
			: 'border-border bg-card hover:border-primary/50'}"
>
	<!-- 시각 -->
	<div class="text-sm font-mono text-muted-foreground shrink-0 w-12 text-center">
		{formatTime(record.sentAt)}
	</div>

	<!-- 중앙: 메모 제목 + 채널 -->
	<div class="flex-1 min-w-0">
		<p class="font-medium text-sm truncate text-foreground">{record.memoTitle || '(제목 없음)'}</p>
		<p class="text-xs text-muted-foreground">{getChannelLabel(record.channel)}</p>
	</div>

	<!-- 상태 배지 -->
	<div class="shrink-0">
		{#if record.status === 'success'}
			<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
				<CheckCircle class="w-3 h-3" />
				성공
			</span>
		{:else if record.status === 'failed'}
			<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
				<XCircle class="w-3 h-3" />
				실패
			</span>
		{:else}
			<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
				<HelpCircle class="w-3 h-3" />
				미확인
			</span>
		{/if}
	</div>
</button>

{#if record.status === 'failed' && record.errorMessage}
	<button
		onclick={(e) => { e.stopPropagation(); showError = !showError; }}
		class="w-full text-left ml-15 px-3 pb-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1"
	>
		<ChevronDown class="w-3 h-3 transition-transform {showError ? 'rotate-180' : ''}" />
		{showError ? record.errorMessage : '에러 상세 보기'}
	</button>
{/if}
