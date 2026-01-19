<script lang="ts">
	import { onMount } from "svelte";
	import { onNavigate } from "$app/navigation";
	import "../app.css";
	import type { Snippet } from "svelte";
	import { themeStore } from "$lib/stores/theme.svelte";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { authStore } from "$lib/stores/auth.svelte";
	import { registerFCMToken, setupForegroundMessageListener } from "$lib/fcm";
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

	// FCM 토큰 등록 (로그인 후)
	async function initFCM() {
		if (authStore.isAuthenticated && authStore.user?.id) {
			try {
				const result = await registerFCMToken(authStore.user.id);
				if (result) {
					console.log('[Layout] FCM token registered:', result.platform);
					setupForegroundMessageListener();
				}
			} catch (error) {
				console.error('[Layout] FCM registration error:', error);
			}
		}
	}

	onMount(() => {
		themeStore.init();
		settingsStore.init();
		notificationStore.init();
		authStore.initialize();

		// authStore 초기화 후 FCM 등록 (약간의 딜레이)
		setTimeout(() => {
			initFCM();
		}, 1000);
	});
</script>

<div class="min-h-screen bg-background pb-20">
	<GlobalNav />
	{@render children()}
	<BottomNav />
</div>

<Toast />
