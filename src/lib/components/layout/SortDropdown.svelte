<script lang="ts">
	import { ArrowUpDown, Check, ChevronDown } from 'lucide-svelte';
	import { filterStore } from '$stores/filter.svelte';
	import type { SortType } from '$types/memo';
	import { cn } from '$utils';

	let showDropdown = $state(false);

	const sortOptions: { id: SortType; label: string }[] = [
		{ id: 'recent', label: '최신순' },
		{ id: 'oldest', label: '오래된순' },
		{ id: 'title', label: '제목순' },
		{ id: 'updated', label: '수정일순' }
	];

	const currentSort = $derived(filterStore.sort);
	const currentLabel = $derived(sortOptions.find((s) => s.id === currentSort)?.label || '최신순');

	function handleSelect(sortType: SortType) {
		filterStore.setSort(sortType);
		showDropdown = false;
	}
</script>

<div class="relative">
	<button
		onclick={() => showDropdown = !showDropdown}
		class={cn(
			'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
			'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
		)}
	>
		<ArrowUpDown class="w-3.5 h-3.5" />
		<span>{currentLabel}</span>
		<ChevronDown class={cn('w-3.5 h-3.5 transition-transform', showDropdown && 'rotate-180')} />
	</button>

	{#if showDropdown}
		<div class="absolute z-50 top-full right-0 mt-1 min-w-[140px] bg-background border border-border rounded-lg shadow-lg overflow-hidden">
			{#each sortOptions as option}
				<button
					onclick={() => handleSelect(option.id)}
					class={cn(
						'flex items-center justify-between w-full px-3 py-2 text-sm text-left transition-colors',
						currentSort === option.id
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'
					)}
				>
					<span>{option.label}</span>
					{#if currentSort === option.id}
						<Check class="w-4 h-4" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<!-- Click outside to close -->
{#if showDropdown}
	<button
		type="button"
		class="fixed inset-0 z-40"
		onclick={() => showDropdown = false}
		aria-label="닫기"
	></button>
{/if}
