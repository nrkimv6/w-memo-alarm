<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { themeStore } from '$lib/stores/theme.svelte';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		themeStore.init();
	});
</script>

<div class="min-h-screen bg-background">
	{@render children()}
</div>
