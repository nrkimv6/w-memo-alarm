<script lang="ts">
	import { Plus, X, GripVertical, Check, Square, CheckSquare } from 'lucide-svelte';
	import type { ChecklistItem } from '$lib/types/memo';
	import { cn } from '$lib/utils';

	interface Props {
		items: ChecklistItem[];
		onItemsChange: (items: ChecklistItem[]) => void;
	}

	let { items, onItemsChange }: Props = $props();

	let newItemText = $state('');

	function generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	function addItem() {
		const text = newItemText.trim();
		if (!text) return;

		const newItem: ChecklistItem = {
			id: generateId(),
			text,
			completed: false
		};
		onItemsChange([...items, newItem]);
		newItemText = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addItem();
		}
	}

	function removeItem(id: string) {
		onItemsChange(items.filter((item) => item.id !== id));
	}

	function toggleItem(id: string) {
		onItemsChange(
			items.map((item) =>
				item.id === id ? { ...item, completed: !item.completed } : item
			)
		);
	}

	function updateItemText(id: string, text: string) {
		onItemsChange(
			items.map((item) => (item.id === id ? { ...item, text } : item))
		);
	}

	const completedCount = $derived(items.filter((item) => item.completed).length);
	const totalCount = $derived(items.length);
	const progress = $derived(totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<span class="text-sm font-medium flex items-center gap-2">
			<CheckSquare class="w-4 h-4" />
			체크리스트
		</span>
		{#if totalCount > 0}
			<span class="text-xs text-muted-foreground">
				{completedCount}/{totalCount} ({progress}%)
			</span>
		{/if}
	</div>

	<!-- Progress bar -->
	{#if totalCount > 0}
		<div class="h-1.5 bg-muted rounded-full overflow-hidden">
			<div
				class="h-full bg-primary transition-all duration-300"
				style="width: {progress}%"
			></div>
		</div>
	{/if}

	<!-- Items list -->
	{#if items.length > 0}
		<div class="space-y-1">
			{#each items as item (item.id)}
				<div
					class={cn(
						'flex items-center gap-2 p-2 rounded-lg bg-muted/50 group',
						item.completed && 'opacity-60'
					)}
				>
					<button
						type="button"
						onclick={() => toggleItem(item.id)}
						class={cn(
							'flex-shrink-0 w-5 h-5 rounded transition-colors',
							item.completed
								? 'text-primary'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						{#if item.completed}
							<CheckSquare class="w-5 h-5" />
						{:else}
							<Square class="w-5 h-5" />
						{/if}
					</button>
					<input
						type="text"
						value={item.text}
						onchange={(e) => updateItemText(item.id, (e.target as HTMLInputElement).value)}
						class={cn(
							'flex-1 bg-transparent text-sm focus:outline-none',
							item.completed && 'line-through text-muted-foreground'
						)}
					/>
					<button
						type="button"
						onclick={() => removeItem(item.id)}
						class="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
					>
						<X class="w-4 h-4" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Add new item -->
	<div class="flex items-center gap-2">
		<input
			type="text"
			placeholder="새 항목 추가..."
			bind:value={newItemText}
			onkeydown={handleKeydown}
			class="flex-1 px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
		/>
		<button
			type="button"
			onclick={addItem}
			disabled={!newItemText.trim()}
			class={cn(
				'p-2 rounded-lg transition-colors',
				newItemText.trim()
					? 'bg-primary text-primary-foreground hover:bg-primary/90'
					: 'bg-muted text-muted-foreground cursor-not-allowed'
			)}
		>
			<Plus class="w-4 h-4" />
		</button>
	</div>
</div>
