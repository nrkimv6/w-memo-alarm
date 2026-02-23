<script lang="ts">
	import { Star, ChevronRight } from 'lucide-svelte';
	import MemoCard from '$lib/components/memo/MemoCard.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import type { Memo } from '$lib/types/memo';

	interface Props {
		memos: Memo[];
		onView: (memo: Memo) => void;
		onEdit: (memo: Memo) => void;
		onDelete: (memo: Memo) => void;
	}

	const { memos, onView, onEdit, onDelete }: Props = $props();
</script>

<section>
	<div class="flex items-center justify-between mb-3">
		<h2 class="text-base font-semibold flex items-center gap-2">
			<Star class="w-4 h-4 text-yellow-500" />
			즐겨찾기
		</h2>
		<a href="/memos?filter=favorites" class="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
			더보기 <ChevronRight class="w-4 h-4" />
		</a>
	</div>
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
		{#each memos as memo (memo.id)}
			<MemoCard
				{memo}
				compact
				onClick={onView}
				onEdit={onEdit}
				onDelete={onDelete}
				onTogglePin={(id) => memosStore.togglePin(id)}
				onToggleFavorite={(id) => memosStore.toggleFavorite(id)}
				onToggleActive={(id) => memosStore.toggleActive(id)}
			/>
		{/each}
	</div>
</section>
