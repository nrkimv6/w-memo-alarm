<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Bell, Trash2, ChevronDown, ChevronUp, X, BarChart3 } from 'lucide-svelte';
	import { notificationHistoryStore } from '$lib/stores/notificationHistory.svelte';
	import HistoryCard from '$lib/components/notifications/HistoryCard.svelte';
	import type { NotificationHistory } from '$lib/types/memo';

	let displayCount = $state(20);
	let statusFilter = $state<'all' | 'success' | 'failed'>('all');
	let periodFilter = $state<'all' | 'today' | '7days' | '30days'>('all');
	let showDeleteConfirm = $state(false);
	let showStats = $state(false);

	// URL 쿼리에서 memoId 읽기
	const memoIdFilter = $derived($page.url.searchParams.get('memoId'));

	// 필터링 파이프라인
	const filteredHistories = $derived(() => {
		let result: NotificationHistory[] = notificationHistoryStore.histories;

		// memoId 필터
		if (memoIdFilter) {
			result = result.filter((h) => h.memoId === memoIdFilter);
		}

		// 상태 필터
		if (statusFilter !== 'all') {
			result = result.filter((h) => h.status === statusFilter);
		}

		// 기간 필터
		if (periodFilter !== 'all') {
			const now = Date.now();
			let cutoff: number;
			if (periodFilter === 'today') {
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				cutoff = today.getTime();
			} else if (periodFilter === '7days') {
				cutoff = now - 7 * 24 * 60 * 60 * 1000;
			} else {
				cutoff = now - 30 * 24 * 60 * 60 * 1000;
			}
			result = result.filter((h) => new Date(h.sentAt).getTime() >= cutoff);
		}

		return result;
	});

	const filteredCount = $derived(filteredHistories().length);
	const totalCount = $derived(notificationHistoryStore.histories.length);
	const hasMore = $derived(filteredCount > displayCount);

	// 표시할 데이터를 displayCount만큼 잘라서 날짜별 그룹핑
	const visibleGrouped = $derived(() => {
		const visible = filteredHistories().slice(0, displayCount);
		const g: Record<string, NotificationHistory[]> = {};
		for (const h of visible) {
			const dateKey = h.sentAt.split('T')[0];
			if (!g[dateKey]) g[dateKey] = [];
			g[dateKey].push(h);
		}
		return g;
	});
	const visibleDateKeys = $derived(
		Object.keys(visibleGrouped()).sort((a, b) => b.localeCompare(a))
	);

	// 통계
	const stats = $derived(notificationHistoryStore.getStats());

	// memoId 필터 중일 때 메모 제목 표시
	const filterMemoTitle = $derived(() => {
		if (!memoIdFilter) return '';
		const record = notificationHistoryStore.histories.find((h) => h.memoId === memoIdFilter);
		return record?.memoTitle || memoIdFilter;
	});

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

	function handleClearAll() {
		notificationHistoryStore.clearAll();
		showDeleteConfirm = false;
	}

	function clearMemoFilter() {
		goto('/notifications');
	}

	const statusTabs = [
		{ id: 'all' as const, label: '전체' },
		{ id: 'success' as const, label: '성공' },
		{ id: 'failed' as const, label: '실패' }
	];

	const periodOptions = [
		{ id: 'all' as const, label: '전체 기간' },
		{ id: 'today' as const, label: '오늘' },
		{ id: '7days' as const, label: '최근 7일' },
		{ id: '30days' as const, label: '최근 30일' }
	];
</script>

<div class="min-h-screen">
	<div class="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
		<div class="max-w-6xl mx-auto px-4 py-4 space-y-3">
			<!-- 제목 + 삭제 -->
			<div class="flex items-center justify-between gap-4">
				<h1 class="text-xl font-bold tracking-tight text-foreground">알림 내역</h1>
				<div class="flex items-center gap-2">
					<span class="text-sm text-muted-foreground">{filteredCount}건</span>
					{#if totalCount > 0}
						<button
							onclick={() => (showStats = !showStats)}
							class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
							title="통계"
						>
							<BarChart3 class="w-4 h-4" />
						</button>
						<button
							onclick={() => (showDeleteConfirm = true)}
							class="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
							title="전체 삭제"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					{/if}
				</div>
			</div>

			<!-- memoId 필터 배지 -->
			{#if memoIdFilter}
				<div
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-sm"
				>
					<span class="text-primary font-medium truncate">{filterMemoTitle()}</span>
					<span class="text-muted-foreground">메모의 알림 내역</span>
					<button onclick={clearMemoFilter} class="ml-auto shrink-0 text-muted-foreground hover:text-foreground">
						<X class="w-4 h-4" />
					</button>
				</div>
			{/if}

			<!-- 필터: 상태 탭 + 기간 셀렉터 -->
			{#if totalCount > 0}
				<div class="flex items-center gap-3">
					<!-- 상태 필터 탭 -->
					<nav class="flex gap-1 p-1 bg-muted rounded-lg">
						{#each statusTabs as tab}
							<button
								onclick={() => { statusFilter = tab.id; displayCount = 20; }}
								class="px-3 py-1 text-xs font-medium rounded-md transition-colors
									{statusFilter === tab.id
									? 'bg-background text-foreground shadow-sm'
									: 'text-muted-foreground hover:text-foreground'}"
							>
								{tab.label}
							</button>
						{/each}
					</nav>

					<!-- 기간 필터 -->
					<select
						bind:value={periodFilter}
						onchange={() => { displayCount = 20; }}
						class="text-xs bg-muted border-0 rounded-lg px-3 py-1.5 text-muted-foreground focus:ring-1 focus:ring-primary"
					>
						{#each periodOptions as opt}
							<option value={opt.id}>{opt.label}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>
	</div>

	<main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
		<!-- 통계 패널 -->
		{#if showStats && totalCount > 0}
			<section class="rounded-lg border border-border bg-card p-4 space-y-3">
				<button
					onclick={() => (showStats = false)}
					class="flex items-center justify-between w-full text-left"
				>
					<h2 class="text-sm font-semibold text-foreground">통계 요약</h2>
					<ChevronUp class="w-4 h-4 text-muted-foreground" />
				</button>
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div class="rounded-lg bg-muted/50 p-3 text-center">
						<p class="text-2xl font-bold text-foreground">{stats.total}</p>
						<p class="text-xs text-muted-foreground">전체 발송</p>
					</div>
					<div class="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center">
						<p class="text-2xl font-bold text-green-700 dark:text-green-400">{stats.successRate}%</p>
						<p class="text-xs text-muted-foreground">성공률</p>
					</div>
					<div class="rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-center">
						<p class="text-2xl font-bold text-green-700 dark:text-green-400">{stats.success}</p>
						<p class="text-xs text-muted-foreground">성공</p>
					</div>
					<div class="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-center">
						<p class="text-2xl font-bold text-red-700 dark:text-red-400">{stats.failed}</p>
						<p class="text-xs text-muted-foreground">실패</p>
					</div>
				</div>
				{#if stats.topMemos.length > 0}
					<div>
						<h3 class="text-xs font-semibold text-muted-foreground mb-2">가장 많이 발송된 메모</h3>
						<div class="space-y-1">
							{#each stats.topMemos as memo, i}
								<div class="flex items-center justify-between text-sm">
									<span class="truncate text-foreground">
										<span class="text-muted-foreground mr-1">{i + 1}.</span>
										{memo.title}
									</span>
									<span class="text-muted-foreground shrink-0 ml-2">{memo.count}건</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</section>
		{/if}

		{#if totalCount === 0}
			<!-- 빈 상태 -->
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
					<Bell class="w-6 h-6 text-muted-foreground" />
				</div>
				<h2 class="text-lg font-semibold mb-1">아직 발송된 알림이 없습니다</h2>
				<p class="text-sm text-muted-foreground">메모에 알림을 설정하면 발송 내역이 여기에 표시됩니다.</p>
			</div>
		{:else if filteredCount === 0}
			<!-- 필터 결과 없음 -->
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<p class="text-muted-foreground">조건에 맞는 내역이 없습니다.</p>
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
						더 보기 ({filteredCount - displayCount}건 남음)
					</button>
				</div>
			{/if}
		{/if}
	</main>
</div>

<!-- 전체 삭제 확인 다이얼로그 -->
{#if showDeleteConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<div class="bg-card rounded-lg border border-border shadow-lg p-6 mx-4 max-w-sm w-full">
			<h3 class="text-lg font-semibold mb-2">전체 내역 삭제</h3>
			<p class="text-sm text-muted-foreground mb-4">
				알림 발송 내역 {totalCount}건을 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.
			</p>
			<div class="flex gap-2 justify-end">
				<button
					onclick={() => (showDeleteConfirm = false)}
					class="px-4 py-2 text-sm rounded-md bg-muted hover:bg-muted/80 transition-colors"
				>
					취소
				</button>
				<button
					onclick={handleClearAll}
					class="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
				>
					전체 삭제
				</button>
			</div>
		</div>
	</div>
{/if}
