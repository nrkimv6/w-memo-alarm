<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<div class="settings-surface-card divide-y divide-border">
	{@render children()}
</div>
