<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { Toast } from '$lib/components/ui';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		themeStore.init();
		settingsStore.init();
	});
</script>

<div class="min-h-screen bg-background">
	{@render children()}
</div>

<Toast />
