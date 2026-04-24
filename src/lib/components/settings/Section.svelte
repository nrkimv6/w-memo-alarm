<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		icon,
		action,
		children
	}: {
		title: string;
		description?: string;
		icon?: Snippet;
		action?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section class="space-y-2">
	<div class="flex items-end justify-between gap-3 px-1">
		<div class="space-y-0.5">
			<h2 class="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-foreground">
				{#if icon}
					<span class="text-muted-foreground">{@render icon()}</span>
				{/if}
				{title}
			</h2>
			{#if description}
				<p class="text-xs leading-relaxed text-muted-foreground">{description}</p>
			{/if}
		</div>
		{#if action}
			{@render action()}
		{/if}
	</div>
	<div class="settings-surface-card">
		{@render children()}
	</div>
</section>
