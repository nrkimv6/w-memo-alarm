<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	let {
		label,
		hint,
		trailing,
		children,
		class: className,
		onclick,
		as = 'div'
	}: {
		label?: string;
		hint?: string;
		trailing?: Snippet;
		children?: Snippet;
		class?: string;
		onclick?: () => void;
		as?: 'div' | 'button';
	} = $props();
</script>

{#if as === 'button'}
	<button
		{onclick}
		class={cn(
			'settings-row transition-colors hover:bg-muted/60 active:bg-muted',
			className
		)}
	>
		<div class="min-w-0 flex-1 space-y-0.5">
			{#if label}<div class="text-sm font-medium text-foreground">{label}</div>{/if}
			{#if hint}<div class="text-xs leading-snug text-muted-foreground">{hint}</div>{/if}
			{#if children}{@render children()}{/if}
		</div>
		{#if trailing}<div class="shrink-0">{@render trailing()}</div>{/if}
	</button>
{:else}
	<div class={cn('settings-row', className)}>
		<div class="min-w-0 flex-1 space-y-0.5">
			{#if label}<div class="text-sm font-medium text-foreground">{label}</div>{/if}
			{#if hint}<div class="text-xs leading-snug text-muted-foreground">{hint}</div>{/if}
			{#if children}{@render children()}{/if}
		</div>
		{#if trailing}<div class="shrink-0">{@render trailing()}</div>{/if}
	</div>
{/if}
