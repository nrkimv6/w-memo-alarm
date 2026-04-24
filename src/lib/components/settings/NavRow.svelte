<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		href,
		label,
		hint,
		icon,
		trailing
	}: {
		href: string;
		label: string;
		hint?: string;
		icon?: Snippet;
		trailing?: Snippet;
	} = $props();
</script>

<a
	{href}
	class="settings-row transition-colors hover:bg-muted/60 active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
>
	{#if icon}
		<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
			{@render icon()}
		</div>
	{/if}
	<div class="min-w-0 flex-1 space-y-0.5">
		<div class="text-sm font-medium text-foreground">{label}</div>
		{#if hint}
			<div class="text-xs leading-snug text-muted-foreground">{hint}</div>
		{/if}
	</div>
	<div class="flex shrink-0 items-center gap-2 text-muted-foreground">
		{#if trailing}{@render trailing()}{/if}
		<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
			<path d="m9 18 6-6-6-6" />
		</svg>
	</div>
</a>
