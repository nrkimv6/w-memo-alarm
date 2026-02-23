<script lang="ts">
	import { BarChart3, Tag, FileText, Bookmark, CheckSquare, Star, Pin, TrendingUp, Calendar } from 'lucide-svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils';

	onMount(() => {
		memosStore.init();
		foldersStore.init();
	});

	// 전체 메모 (활성 + 비활성)
	const allMemos = $derived(memosStore.memos);
	const activeMemos = $derived(allMemos.filter((m) => m.isActive !== false));
	const notes = $derived(activeMemos.filter((m) => m.memoType === 'note' || m.memoType === 'task' || !m.memoType));
	const bookmarks = $derived(activeMemos.filter((m) => m.memoType === 'bookmark'));
	const todos = $derived(activeMemos.filter((m) => m.memoType === 'todo'));
	const pinned = $derived(activeMemos.filter((m) => m.isPinned));
	const favorites = $derived(activeMemos.filter((m) => m.isFavorite));

	// 태그 통계
	const tagStats = $derived(() => {
		const counts: Record<string, number> = {};
		for (const memo of activeMemos) {
			for (const tag of memo.tags ?? []) {
				counts[tag] = (counts[tag] ?? 0) + 1;
			}
		}
		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 15);
	});

	// 폴더별 통계
	const folderStats = $derived(() => {
		const counts: Record<string, number> = {};
		for (const memo of activeMemos) {
			const key = memo.folderId ?? '__none__';
			counts[key] = (counts[key] ?? 0) + 1;
		}
		return Object.entries(counts)
			.map(([folderId, count]) => {
				const folder = folderId !== '__none__' ? foldersStore.getById(folderId) : null;
				return { name: folder?.name ?? '폴더 없음', color: folder?.color ?? '#888', count };
			})
			.sort((a, b) => b.count - a.count);
	});

	// 최근 7일 메모 작성 빈도
	const weeklyActivity = $derived(() => {
		const days: { label: string; date: string; count: number }[] = [];
		const today = new Date();
		for (let i = 6; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(today.getDate() - i);
			const dateStr = d.toISOString().split('T')[0];
			const count = activeMemos.filter((m) => {
				const created = new Date(m.createdAt).toISOString().split('T')[0];
				return created === dateStr;
			}).length;
			days.push({
				label: i === 0 ? '오늘' : i === 1 ? '어제' : `${i}일 전`,
				date: dateStr,
				count
			});
		}
		return days;
	});

	// 최근 30일 메모 작성 빈도 (히트맵용)
	const monthlyActivity = $derived(() => {
		const days: { date: string; count: number }[] = [];
		const today = new Date();
		for (let i = 29; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(today.getDate() - i);
			const dateStr = d.toISOString().split('T')[0];
			const count = activeMemos.filter((m) => {
				const created = new Date(m.createdAt).toISOString().split('T')[0];
				return created === dateStr;
			}).length;
			days.push({ date: dateStr, count });
		}
		return days;
	});

	// 최대값 (막대 그래프 스케일용)
	const maxWeeklyCount = $derived(Math.max(...weeklyActivity().map((d) => d.count), 1));
	const maxMonthlyCount = $derived(Math.max(...monthlyActivity().map((d) => d.count), 1));

	// 이번 달 작성한 메모 수
	const thisMonthCount = $derived(() => {
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
		return activeMemos.filter((m) => m.createdAt >= startOfMonth).length;
	});

	// 이번 주 작성한 메모 수
	const thisWeekCount = $derived(() => {
		const now = new Date();
		const startOfWeek = new Date(now);
		startOfWeek.setDate(now.getDate() - now.getDay());
		startOfWeek.setHours(0, 0, 0, 0);
		return activeMemos.filter((m) => m.createdAt >= startOfWeek.getTime()).length;
	});

	function getHeatmapColor(count: number, max: number): string {
		if (count === 0) return 'bg-muted/30';
		const ratio = count / max;
		if (ratio < 0.25) return 'bg-primary/20';
		if (ratio < 0.5) return 'bg-primary/40';
		if (ratio < 0.75) return 'bg-primary/60';
		return 'bg-primary/90';
	}
</script>

<svelte:head>
	<title>통계 - Memo Alarm</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
		<div class="flex items-center gap-3 px-4 py-3">
			<a href="/" class="text-muted-foreground hover:text-foreground transition-colors">
				<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
			</a>
			<div class="flex items-center gap-2">
				<BarChart3 class="w-5 h-5 text-primary" />
				<h1 class="text-lg font-semibold">통계</h1>
			</div>
		</div>
	</header>

	<div class="px-4 py-6 space-y-6 max-w-2xl mx-auto">

		<!-- 요약 카드 -->
		<section>
			<h2 class="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">전체 현황</h2>
			<div class="grid grid-cols-2 gap-3">
				<div class="bg-card rounded-xl border border-border p-4">
					<div class="flex items-center gap-2 mb-1">
						<FileText class="w-4 h-4 text-primary" />
						<span class="text-xs text-muted-foreground">전체 메모</span>
					</div>
					<p class="text-2xl font-bold">{activeMemos.length}</p>
					<p class="text-xs text-muted-foreground mt-1">이번 주 +{thisWeekCount()}</p>
				</div>
				<div class="bg-card rounded-xl border border-border p-4">
					<div class="flex items-center gap-2 mb-1">
						<Calendar class="w-4 h-4 text-blue-500" />
						<span class="text-xs text-muted-foreground">이번 달</span>
					</div>
					<p class="text-2xl font-bold">{thisMonthCount()}</p>
					<p class="text-xs text-muted-foreground mt-1">메모 작성</p>
				</div>
				<div class="bg-card rounded-xl border border-border p-4">
					<div class="flex items-center gap-2 mb-1">
						<Bookmark class="w-4 h-4 text-orange-500" />
						<span class="text-xs text-muted-foreground">북마크</span>
					</div>
					<p class="text-2xl font-bold">{bookmarks.length}</p>
					<p class="text-xs text-muted-foreground mt-1">저장된 링크</p>
				</div>
				<div class="bg-card rounded-xl border border-border p-4">
					<div class="flex items-center gap-2 mb-1">
						<CheckSquare class="w-4 h-4 text-green-500" />
						<span class="text-xs text-muted-foreground">할일</span>
					</div>
					<p class="text-2xl font-bold">{todos.length}</p>
					<p class="text-xs text-muted-foreground mt-1">
						완료: {todos.filter((t) => t.todoStatus === 'completed').length}
					</p>
				</div>
			</div>
		</section>

		<!-- 즐겨찾기 / 고정 -->
		<section>
			<div class="grid grid-cols-2 gap-3">
				<div class="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
					<Star class="w-5 h-5 text-yellow-500" />
					<div>
						<p class="text-xl font-bold">{favorites.length}</p>
						<p class="text-xs text-muted-foreground">즐겨찾기</p>
					</div>
				</div>
				<div class="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
					<Pin class="w-5 h-5 text-red-500" />
					<div>
						<p class="text-xl font-bold">{pinned.length}</p>
						<p class="text-xs text-muted-foreground">고정된 메모</p>
					</div>
				</div>
			</div>
		</section>

		<!-- 최근 7일 활동 -->
		<section>
			<h2 class="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">최근 7일 활동</h2>
			<div class="bg-card rounded-xl border border-border p-4">
				{#if weeklyActivity().every((d) => d.count === 0)}
					<p class="text-sm text-muted-foreground text-center py-4">최근 7일간 작성한 메모가 없습니다</p>
				{:else}
					<div class="flex items-end gap-2 h-24">
						{#each weeklyActivity() as day}
							<div class="flex-1 flex flex-col items-center gap-1">
								<span class="text-xs text-muted-foreground">{day.count > 0 ? day.count : ''}</span>
								<div
									class="w-full rounded-t-sm bg-primary transition-all"
									style="height: {day.count === 0 ? '2px' : `${(day.count / maxWeeklyCount) * 72}px`}; opacity: {day.count === 0 ? 0.15 : 1}"
								></div>
								<span class="text-xs text-muted-foreground whitespace-nowrap" style="font-size: 10px">{day.label}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<!-- 30일 히트맵 -->
		<section>
			<h2 class="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">최근 30일 히트맵</h2>
			<div class="bg-card rounded-xl border border-border p-4">
				<div class="grid grid-cols-10 gap-1">
					{#each monthlyActivity() as day}
						<div
							class={cn('aspect-square rounded-sm', getHeatmapColor(day.count, maxMonthlyCount))}
							title="{day.date}: {day.count}개"
						></div>
					{/each}
				</div>
				<div class="flex items-center gap-2 mt-3 justify-end">
					<span class="text-xs text-muted-foreground">적음</span>
					<div class="w-3 h-3 rounded-sm bg-muted/30"></div>
					<div class="w-3 h-3 rounded-sm bg-primary/20"></div>
					<div class="w-3 h-3 rounded-sm bg-primary/50"></div>
					<div class="w-3 h-3 rounded-sm bg-primary/90"></div>
					<span class="text-xs text-muted-foreground">많음</span>
				</div>
			</div>
		</section>

		<!-- 태그 통계 -->
		<section>
			<h2 class="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">태그 사용 빈도</h2>
			<div class="bg-card rounded-xl border border-border p-4">
				{#if tagStats().length === 0}
					<p class="text-sm text-muted-foreground text-center py-4">태그가 없습니다</p>
				{:else}
					<div class="space-y-2">
						{#each tagStats() as [tag, count]}
							{@const maxCount = tagStats()[0][1]}
							<div class="flex items-center gap-3">
								<div class="flex items-center gap-1.5 w-28 flex-shrink-0">
									<Tag class="w-3 h-3 text-muted-foreground flex-shrink-0" />
									<span class="text-sm truncate">{tag}</span>
								</div>
								<div class="flex-1 bg-muted/30 rounded-full h-2">
									<div
										class="bg-primary h-2 rounded-full transition-all"
										style="width: {(count / maxCount) * 100}%"
									></div>
								</div>
								<span class="text-xs text-muted-foreground w-6 text-right">{count}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<!-- 폴더별 분포 -->
		{#if folderStats().length > 1}
		<section>
			<h2 class="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">폴더별 분포</h2>
			<div class="bg-card rounded-xl border border-border p-4 space-y-2">
				{#each folderStats() as item}
					{@const total = activeMemos.length || 1}
					<div class="flex items-center gap-3">
						<div
							class="w-2.5 h-2.5 rounded-full flex-shrink-0"
							style="background-color: {item.color}"
						></div>
						<span class="text-sm flex-1 truncate">{item.name}</span>
						<div class="w-24 bg-muted/30 rounded-full h-2">
							<div
								class="h-2 rounded-full transition-all"
								style="width: {(item.count / total) * 100}%; background-color: {item.color}"
							></div>
						</div>
						<span class="text-xs text-muted-foreground w-6 text-right">{item.count}</span>
					</div>
				{/each}
			</div>
		</section>
		{/if}

		<!-- 메모 유형 분포 -->
		<section>
			<h2 class="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">메모 유형 분포</h2>
			<div class="bg-card rounded-xl border border-border p-4 space-y-2">
				{#each [
					{ label: '일반 메모', count: notes.length, color: '#6366f1', icon: '📝' },
					{ label: '북마크', count: bookmarks.length, color: '#f97316', icon: '🔖' },
					{ label: '할일', count: todos.length, color: '#22c55e', icon: '✅' },
				] as item}
					{@const total = activeMemos.length || 1}
					<div class="flex items-center gap-3">
						<span class="text-sm">{item.icon}</span>
						<span class="text-sm flex-1">{item.label}</span>
						<div class="w-24 bg-muted/30 rounded-full h-2">
							<div
								class="h-2 rounded-full transition-all"
								style="width: {(item.count / total) * 100}%; background-color: {item.color}"
							></div>
						</div>
						<span class="text-xs text-muted-foreground w-8 text-right">{item.count}</span>
					</div>
				{/each}
			</div>
		</section>

	</div>
</div>
