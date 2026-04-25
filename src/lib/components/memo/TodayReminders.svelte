<script lang="ts">
	import { Bell, Clock, ExternalLink, ChevronDown, ChevronUp } from 'lucide-svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { cn } from '$lib/utils';
	import { isSafeOpenUrl } from '$lib/utils/url';
	import type { Memo } from '$lib/types/memo';

	interface Props {
		onMemoClick?: (memo: Memo) => void;
		onViewAll?: () => void;
	}

	let { onMemoClick, onViewAll }: Props = $props();

	let expanded = $state(true);

	const upcomingReminders = $derived(notificationStore.getUpcomingReminders());
	const pastReminders = $derived(notificationStore.getPastReminders());
	const hasReminders = $derived(upcomingReminders.length > 0 || pastReminders.length > 0);

	function formatTime(time: string): string {
		const [hours, minutes] = time.split(':');
		const h = parseInt(hours);
		const period = h >= 12 ? '오후' : '오전';
		const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
		return `${period} ${displayHour}:${minutes}`;
	}

	function handleUrlClick(memo: Memo, e: MouseEvent) {
		e.stopPropagation();
		if (memo.url && isSafeOpenUrl(memo.url)) {
			memosStore.incrementOpenCount(memo.id);
			window.open(memo.url, '_blank');
		}
	}
</script>

{#if hasReminders}
	<div class="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl border border-primary/20 overflow-hidden">
		<button
			onclick={() => expanded = !expanded}
			class="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-colors"
		>
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
					<Bell class="w-5 h-5 text-primary" />
				</div>
				<div class="text-left">
					<h2 class="font-semibold">오늘의 알림</h2>
					<p class="text-sm text-muted-foreground">
						{upcomingReminders.length}개 예정
						{#if pastReminders.length > 0}
							· {pastReminders.length}개 완료
						{/if}
					</p>
				</div>
			</div>
			{#if expanded}
				<ChevronUp class="w-5 h-5 text-muted-foreground" />
			{:else}
				<ChevronDown class="w-5 h-5 text-muted-foreground" />
			{/if}
		</button>

		{#if expanded}
			<div class="px-4 pb-4 space-y-2">
				<!-- 전체 알림 보기 버튼 -->
				{#if onViewAll}
					<button
						onclick={onViewAll}
						class="w-full text-center py-2 text-sm text-primary hover:text-primary/80 transition-colors"
					>
						전체 알림 보기
					</button>
				{/if}
				<!-- 예정된 알림 -->
				{#each upcomingReminders as memo}
					<button
						onclick={() => onMemoClick?.(memo)}
						class="w-full flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-muted transition-colors text-left"
					>
						<div class="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
							<Clock class="w-4 h-4 text-primary" />
						</div>
						<div class="flex-1 min-w-0">
							<p class="font-medium truncate">{memo.title}</p>
							<p class="text-sm text-primary">{formatTime(memo.reminder?.time || '00:00')}</p>
						</div>
						{#if memo.url}
							<button
								onclick={(e) => handleUrlClick(memo, e)}
								class="p-2 rounded-md hover:bg-primary/10 transition-colors"
							>
								<ExternalLink class="w-4 h-4 text-muted-foreground" />
							</button>
						{/if}
					</button>
				{/each}

				<!-- 완료된 알림 -->
				{#if pastReminders.length > 0}
					<div class="pt-2 border-t border-border/50">
						<p class="text-xs text-muted-foreground mb-2 px-1">완료됨</p>
						{#each pastReminders as memo}
							<button
								onclick={() => onMemoClick?.(memo)}
								class="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left opacity-60"
							>
								<div class="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
									<Clock class="w-3 h-3 text-muted-foreground" />
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-sm truncate">{memo.title}</p>
								</div>
								<span class="text-xs text-muted-foreground">
									{formatTime(memo.reminder?.time || '00:00')}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
