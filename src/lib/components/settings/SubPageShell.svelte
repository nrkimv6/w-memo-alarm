<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		eyebrow,
		description,
		children
	}: {
		title: string;
		eyebrow?: string;
		description?: string;
		children: Snippet;
	} = $props();
</script>

<div class="min-h-screen">
	<header class="sticky top-14 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
		<div class="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
			<a
				href="/settings"
				class="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
			>
				<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m15 18-6-6 6-6" />
				</svg>
				설정
			</a>
			<h1 class="text-base font-semibold tracking-tight">{title}</h1>
			<div class="w-14" />
		</div>
	</header>

	<main class="mx-auto max-w-2xl space-y-6 px-4 pt-6">
		{#if eyebrow || description}
			<div class="px-1">
				{#if eyebrow}
					<p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
				{/if}
				{#if description}
					<p class="mt-0.5 text-sm text-muted-foreground">{description}</p>
				{/if}
			</div>
		{/if}
		{@render children()}
	</main>
</div>
