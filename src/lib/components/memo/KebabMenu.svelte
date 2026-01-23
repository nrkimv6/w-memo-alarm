<script lang="ts">
	import { Edit3, Trash2, EyeOff, Eye, Folder, MoreVertical } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		isInactive?: boolean;
		hasToggleActive?: boolean;
		onEdit: () => void;
		onDelete: () => void;
		onToggleActive?: () => void;
		onMoveToFolder?: () => void;
	}

	let { isInactive = false, hasToggleActive = false, onEdit, onDelete, onToggleActive, onMoveToFolder }: Props = $props();

	let isOpen = $state(false);
	let menuElement: HTMLDivElement;

	function handleToggle(e: MouseEvent) {
		e.stopPropagation();
		isOpen = !isOpen;
	}

	function handleClickOutside(e: MouseEvent) {
		if (menuElement && !menuElement.contains(e.target as Node)) {
			isOpen = false;
		}
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
		} else {
			document.removeEventListener('click', handleClickOutside);
		}
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	function handleMenuClick(action: () => void) {
		return (e: MouseEvent) => {
			e.stopPropagation();
			action();
			isOpen = false;
		};
	}
</script>

<div class="relative" bind:this={menuElement}>
	<button
		onclick={handleToggle}
		class="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
		title="메뉴"
	>
		<MoreVertical class="w-5 h-5" />
	</button>

	{#if isOpen}
		<div class="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
			<button
				onclick={handleMenuClick(onEdit)}
				class="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
			>
				<Edit3 class="w-4 h-4" />
				<span>수정</span>
			</button>
			<button
				onclick={handleMenuClick(onDelete)}
				class="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
			>
				<Trash2 class="w-4 h-4" />
				<span>삭제</span>
			</button>
			{#if hasToggleActive && onToggleActive}
				<button
					onclick={handleMenuClick(onToggleActive)}
					class="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
				>
					{#if isInactive}
						<Eye class="w-4 h-4" />
						<span>활성화</span>
					{:else}
						<EyeOff class="w-4 h-4" />
						<span>숨기기</span>
					{/if}
				</button>
			{/if}
			{#if onMoveToFolder}
				<button
					onclick={handleMenuClick(onMoveToFolder)}
					class="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
				>
					<Folder class="w-4 h-4" />
					<span>폴더 이동</span>
				</button>
			{/if}
		</div>
	{/if}
</div>
