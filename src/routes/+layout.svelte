<script lang="ts">
	import { onMount } from "svelte";
	import { onNavigate } from "$app/navigation";
	import "../app.css";
	import type { Snippet } from "svelte";
	import { themeStore } from "$lib/stores/theme.svelte";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { authStore } from "$lib/stores/auth.svelte";
	import { Toast } from "$lib/components/ui";
	import GlobalNav from "$lib/components/GlobalNav.svelte";
	import BottomNav from "$lib/components/BottomNav.svelte";

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
		authStore.initialize();
	});
</script>

<div class="min-h-screen bg-background pb-20">
	<GlobalNav />
	{@render children()}
	<BottomNav />
</div>

<Toast />
