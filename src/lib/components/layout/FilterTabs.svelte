<script lang="ts">
	import { cn } from '$utils';
	import { Pin, Star, Bookmark, Grid, List, EyeOff, LayoutList } from 'lucide-svelte';
	import { filterStore } from '$stores/filter.svelte';
	import SortDropdown from './SortDropdown.svelte';
	import type { FilterType } from '$types/memo';

	const tabs: { id: FilterType; label: string; icon?: typeof Pin }[] = [
		{ id: 'all', label: '전체' },
		{ id: 'pinned', label: '핀', icon: Pin },
		{ id: 'favorites', label: '즐겨찾기', icon: Star },
		{ id: 'bookmarked', label: '북마크', icon: Bookmark }
	];

	const currentFilter = $derived(filterStore.filter);
	const currentViewMode = $derived(filterStore.viewMode);
	const showInactive = $derived(filterStore.showInactive);
</script>

<div class="flex items-center justify-between gap-2 overflow-x-auto overflow-y-hidden pb-1 -mx-4 px-4">
	<!-- Filter tabs -->
	<nav class="flex gap-1 p-1 bg-muted rounded-lg flex-shrink-0">
		{#each tabs as tab}
			<button
				onclick={() => filterStore.setFilter(tab.id)}
				class={cn(
					'flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap',
					currentFilter === tab.id
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'
				)}
			>
				{#if tab.icon}
					<tab.icon class="w-3 sm:w-3.5 h-3 sm:h-3.5" />
				{/if}
				<span class="hidden sm:inline">{tab.label}</span>
				<span class="sm:hidden">{tab.label.slice(0, 2)}</span>
			</button>
		{/each}
	</nav>

	<!-- Sort and View controls -->
	<div class="flex items-center gap-1 sm:gap-2 flex-shrink-0">
		<!-- Show inactive toggle -->
		<button
			onclick={() => filterStore.setShowInactive(!showInactive)}
			class={cn(
				'flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-sm font-medium transition-colors',
				showInactive
					? 'bg-muted/80 text-foreground'
					: 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
			)}
			title={showInactive ? '비활성 숨기기' : '비활성 표시'}
		>
			<EyeOff class="w-3.5 h-3.5" />
		</button>

		<!-- Sort dropdown -->
		<SortDropdown />

		<!-- View mode toggle -->
		<div class="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-muted rounded-lg">
			<button
				onclick={() => filterStore.setViewMode('grid')}
				class={cn(
					'p-1 sm:p-1.5 rounded-md transition-all',
					currentViewMode === 'grid'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'
				)}
				title="그리드 뷰"
			>
				<Grid class="w-3.5 sm:w-4 h-3.5 sm:h-4" />
			</button>
			<button
				onclick={() => filterStore.setViewMode('list')}
				class={cn(
					'p-1 sm:p-1.5 rounded-md transition-all',
					currentViewMode === 'list'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'
				)}
				title="리스트 뷰"
			>
				<List class="w-3.5 sm:w-4 h-3.5 sm:h-4" />
			</button>
			<button
				onclick={() => filterStore.setViewMode('compact')}
				class={cn(
					'p-1 sm:p-1.5 rounded-md transition-all',
					currentViewMode === 'compact'
						? 'bg-background text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'
				)}
				title="컴팩트 뷰"
			>
				<LayoutList class="w-3.5 sm:w-4 h-3.5 sm:h-4" />
			</button>
		</div>
	</div>
</div>
