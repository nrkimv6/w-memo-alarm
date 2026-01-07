<script lang="ts">
	import { X } from 'lucide-svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { filterStore } from '$lib/stores/filter.svelte';
	import { cn } from '$lib/utils';

	const allTags = $derived(memosStore.getAllTags());
	const selectedTags = $derived(filterStore.selectedTags);
</script>

{#if allTags.length > 0}
	<div class="flex flex-wrap gap-2 items-center">
		{#each allTags as tag}
			<button
				onclick={() => filterStore.toggleTag(tag)}
				class={cn(
					'px-2.5 py-1 text-xs rounded-full border transition-colors',
					selectedTags.includes(tag)
						? 'bg-primary text-primary-foreground border-primary'
						: 'bg-background border-border hover:border-primary/50'
				)}
			>
				{tag}
			</button>
		{/each}

		{#if selectedTags.length > 0}
			<button
				onclick={() => filterStore.clearTags()}
				class="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
			>
				<X class="w-3 h-3" />
				초기화
			</button>
		{/if}
	</div>
{/if}
