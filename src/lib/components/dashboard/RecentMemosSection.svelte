<script lang="ts">
	import { Clock, ChevronRight } from 'lucide-svelte';
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
			<Clock class="w-4 h-4 text-muted-foreground" />
			최신 메모
		</h2>
		<a href="/memos" class="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
			전체 보기 <ChevronRight class="w-4 h-4" />
		</a>
	</div>
	<div class="space-y-2">
		{#each memos as memo (memo.id)}
			<MemoCard
				{memo}
				compact
				ultraCompact
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
