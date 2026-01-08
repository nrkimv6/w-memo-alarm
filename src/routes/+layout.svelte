<script lang="ts">
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import { Toast } from '$lib/components/ui';

	let { children }: { children: Snippet } = $props();

	// View Transitions API
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	onMount(() => {
		themeStore.init();
		settingsStore.init();
		notificationStore.init();
	});
</script>

<div class="min-h-screen bg-background">
	{@render children()}
</div>

<Toast />
