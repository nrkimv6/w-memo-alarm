<script lang="ts">
	import { Search, X } from 'lucide-svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { filterStore } from '$lib/stores/filter.svelte';

	let inputValue = $state(filterStore.searchQuery);

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		inputValue = target.value;
		filterStore.setSearch(target.value);
	}

	function clearSearch() {
		inputValue = '';
		filterStore.setSearch('');
	}
</script>

<div class="relative w-full max-w-md">
	<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
	<input
		type="text"
		placeholder="메모 검색... (/ 로 포커스)"
		value={inputValue}
		oninput={handleInput}
		data-search-input
		class="w-full pl-9 pr-9 py-2 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sketchy-input"
	/>
	{#if inputValue}
		<button
			onclick={clearSearch}
			class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
		>
			<X class="w-4 h-4" />
		</button>
	{/if}
</div>
