<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div class="mx-3 my-2 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-[12px] leading-relaxed text-foreground">
	<svg
		class="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.2"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 8v4M12 16h.01" />
	</svg>
	<span>{@render children()}</span>
</div>
