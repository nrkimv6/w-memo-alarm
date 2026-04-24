<script lang="ts">
	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<h3 class="settings-group-label">{@render children()}</h3>
