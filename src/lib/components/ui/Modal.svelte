<script lang="ts">
	import { cn } from '$lib/utils';
	import { fade } from 'svelte/transition';
	import { X } from 'lucide-svelte';

	let {
		open = $bindable(false),
		title,
		children,
		footer,
		class: className
	} = $props();

	function close() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
		transition:fade={{ duration: 200 }}
		onclick={close}
		role="presentation"
	></div>

	<!-- Modal Content -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
		<div
			class={cn(
				'bg-card w-full max-w-lg rounded-xl border border-border shadow-lg pointer-events-auto',
				'modal-appear flex flex-col max-h-[90vh]',
				className
			)}
			role="dialog"
			aria-modal="true"
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-6 pb-4 border-b border-border/40">
				<h2 class="text-xl font-bold tracking-tight">{title}</h2>
				<button
					onclick={close}
					class="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
				>
					<X class="w-5 h-5" />
					<span class="sr-only">Close</span>
				</button>
			</div>

			<!-- Body -->
			<div class="p-6 overflow-y-auto custom-scrollbar flex-1">
				{@render children?.()}
			</div>

			<!-- Footer -->
			{#if footer}
				<div
					class="p-6 pt-4 border-t border-border/40 flex justify-end gap-2 bg-muted/20 rounded-b-xl"
				>
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
