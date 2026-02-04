<script lang="ts">
	import { Bell } from 'lucide-svelte';
	import { notificationHistoryStore } from '$lib/stores/notificationHistory.svelte';
	import HistoryCard from '$lib/components/notifications/HistoryCard.svelte';

	let displayCount = $state(20);

	const grouped = $derived(notificationHistoryStore.getGroupedByDate());
	const dateKeys = $derived(Object.keys(grouped).sort((a, b) => b.localeCompare(a)));
	const totalCount = $derived(notificationHistoryStore.histories.length);
	const hasMore = $derived(totalCount > displayCount);

	// 표시할 데이터를 displayCount만큼 잘라서 날짜별 그룹핑
	const visibleHistories = $derived(notificationHistoryStore.histories.slice(0, displayCount));
	const visibleGrouped = $derived(() => {
		const g: Record<string, typeof visibleHistories> = {};
		for (const h of visibleHistories) {
			const dateKey = h.sentAt.split('T')[0];
			if (!g[dateKey]) g[dateKey] = [];
			g[dateKey].push(h);
		}
		return g;
	});
	const visibleDateKeys = $derived(Object.keys(visibleGrouped()).sort((a, b) => b.localeCompare(a)));

	function formatDateLabel(dateStr: string): string {
		const date = new Date(dateStr + 'T00:00:00');
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (date.getTime() === today.getTime()) return '오늘';
		if (date.getTime() === yesterday.getTime()) return '어제';
		return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
	}

	function loadMore() {
		displayCount += 20;
	}
</script>

<div class="min-h-screen">
	<div class="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
		<div class="max-w-6xl mx-auto px-4 py-4">
			<div class="flex items-center justify-between gap-4">
				<h1 class="text-xl font-bold tracking-tight text-foreground">알림 내역</h1>
				<span class="text-sm text-muted-foreground">{totalCount}건</span>
			</div>
		</div>
	</div>

	<main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
		{#if totalCount === 0}
			<!-- 빈 상태 -->
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
					<Bell class="w-6 h-6 text-muted-foreground" />
				</div>
				<h2 class="text-lg font-semibold mb-1">아직 발송된 알림이 없습니다</h2>
				<p class="text-sm text-muted-foreground">메모에 알림을 설정하면 발송 내역이 여기에 표시됩니다.</p>
			</div>
		{:else}
			{#each visibleDateKeys as dateKey (dateKey)}
				<section>
					<h2 class="text-sm font-semibold text-muted-foreground mb-2">
						{formatDateLabel(dateKey)}
					</h2>
					<div class="space-y-2">
						{#each visibleGrouped()[dateKey] as record (record.id)}
							<HistoryCard {record} />
						{/each}
					</div>
				</section>
			{/each}

			{#if hasMore}
				<div class="flex justify-center pt-2 pb-4">
					<button
						onclick={loadMore}
						class="rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
					>
						더 보기 ({totalCount - displayCount}건 남음)
					</button>
				</div>
			{/if}
		{/if}
	</main>
</div>
