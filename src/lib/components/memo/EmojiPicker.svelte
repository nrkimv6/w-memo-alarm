<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		selected: string;
		onSelect: (emoji: string) => void;
	}

	let { selected, onSelect }: Props = $props();

	let showPicker = $state(false);

	const emojis = [
		'🔗', '📎', '🌐', '💻', '📱', '🎮', '🎬', '🎵',
		'📚', '📖', '✏️', '📝', '💡', '⭐', '❤️', '🔥',
		'✅', '📌', '🎯', '🚀', '💼', '🛒', '🍕', '☕',
		'🏠', '🚗', '✈️', '🌍', '🌙', '☀️', '🌈', '🎨'
	];

	function handleSelect(emoji: string) {
		onSelect(emoji);
		showPicker = false;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.emoji-picker-container')) {
			showPicker = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="emoji-picker-container relative">
	<button
		type="button"
		onclick={() => showPicker = !showPicker}
		class={cn(
			'w-10 h-10 rounded-lg border border-input flex items-center justify-center text-xl',
			'hover:bg-muted transition-colors',
			showPicker && 'ring-2 ring-ring'
		)}
	>
		{selected || '🔗'}
	</button>

	{#if showPicker}
		<div class="absolute top-12 left-0 z-50 bg-background border border-border rounded-lg shadow-lg p-2 w-64">
			<div class="grid grid-cols-8 gap-1">
				{#each emojis as emoji}
					<button
						type="button"
						onclick={() => handleSelect(emoji)}
						class={cn(
							'w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors',
							selected === emoji && 'bg-primary/10'
						)}
					>
						{emoji}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
