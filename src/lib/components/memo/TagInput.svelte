<script lang="ts">
	import { X, Plus } from 'lucide-svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';

	interface Props {
		tags: string[];
		onTagsChange: (tags: string[]) => void;
	}

	let { tags, onTagsChange }: Props = $props();

	let inputValue = $state('');
	let showSuggestions = $state(false);
	let inputRef = $state<HTMLInputElement | null>(null);

	const allTags = $derived(memosStore.getAllTags());
	const suggestions = $derived(
		inputValue.trim()
			? allTags
					.filter(
						(t) =>
							t.toLowerCase().includes(inputValue.toLowerCase()) &&
							!tags.includes(t)
					)
					.slice(0, 5)
			: []
	);

	function addTag(tag?: string) {
		const value = (tag || inputValue).trim();
		if (value && !tags.includes(value)) {
			onTagsChange([...tags, value]);
		}
		inputValue = '';
		showSuggestions = false;
	}

	function removeTag(tag: string) {
		onTagsChange(tags.filter((t) => t !== tag));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (suggestions.length > 0) {
				addTag(suggestions[0]);
			} else {
				addTag();
			}
		} else if (e.key === 'Escape') {
			showSuggestions = false;
		}
	}

	function handleFocus() {
		showSuggestions = true;
	}

	function handleBlur() {
		// Delay to allow click on suggestion
		setTimeout(() => {
			showSuggestions = false;
		}, 150);
	}
</script>

<div class="space-y-2">
	<span class="text-sm font-medium">태그</span>
	<div class="relative">
		<div class="flex gap-2">
			<Input
				placeholder="태그 입력 후 Enter"
				bind:value={inputValue}
				onkeydown={handleKeydown}
				onfocus={handleFocus}
				onblur={handleBlur}
				class="flex-1"
			/>
			<Button type="button" variant="secondary" size="icon" onclick={() => addTag()}>
				<Plus class="w-4 h-4" />
			</Button>
		</div>

		<!-- Autocomplete suggestions -->
		{#if showSuggestions && suggestions.length > 0}
			<div class="absolute z-10 w-full mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
				{#each suggestions as suggestion}
					<button
						type="button"
						class="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
						onclick={() => addTag(suggestion)}
					>
						{suggestion}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Selected tags -->
	{#if tags.length > 0}
		<div class="flex flex-wrap gap-2">
			{#each tags as tag}
				<Badge variant="sketchy" class="pr-1">
					{tag}
					<button
						type="button"
						onclick={() => removeTag(tag)}
						class="ml-1 p-0.5 hover:bg-black/10 rounded-full"
					>
						<X class="w-3 h-3" />
					</button>
				</Badge>
			{/each}
		</div>
	{/if}
</div>
