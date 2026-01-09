<script lang="ts">
	import { onMount } from "svelte";
	import { Sun, Moon, Bell, X } from "lucide-svelte";
	import Button from "$lib/components/ui/Button.svelte";
	import { themeStore } from "$lib/stores/theme.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	let showNotificationBanner = $state(false);
	let dismissed = $state(false);

	onMount(() => {
		// Show banner if notifications are supported but not granted
		if (typeof window !== "undefined" && "Notification" in window) {
			const permission = Notification.permission;
			// Only show if default (never asked) and not dismissed before
			const wasDismissed = localStorage.getItem(
				"memo-alarm:notification-banner-dismissed",
			);
			showNotificationBanner = permission === "default" && !wasDismissed;
		}
	});

	async function handleRequestPermission() {
		const granted = await notificationStore.requestPermission();
		showNotificationBanner = false;
		if (granted) {
			localStorage.setItem(
				"memo-alarm:notification-banner-dismissed",
				"true",
			);
		}
	}

	function dismissBanner() {
		dismissed = true;
		showNotificationBanner = false;
		localStorage.setItem(
			"memo-alarm:notification-banner-dismissed",
			"true",
		);
	}
</script>

<!-- Notification Permission Banner -->
{#if showNotificationBanner && !dismissed}
	<div class="bg-primary/10 border-b border-primary/20 px-4 py-2">
		<div
			class="container flex items-center justify-between gap-4 mx-auto max-w-7xl"
		>
			<div class="flex items-center gap-2 text-sm">
				<Bell class="w-4 h-4 text-primary" />
				<span>알림을 받으려면 권한을 허용해주세요</span>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="default"
					size="sm"
					onclick={handleRequestPermission}
				>
					허용
				</Button>
				<button
					onclick={dismissBanner}
					class="p-1 rounded-full hover:bg-primary/10 transition-colors"
					title="닫기"
				>
					<X class="w-4 h-4" />
				</button>
			</div>
		</div>
	</div>
{/if}

<header
	class="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md"
>
	<div class="container flex h-14 items-center gap-4 px-4 mx-auto max-w-7xl">
		<div class="mr-4 flex items-center gap-2">
			<a
				href="/"
				class="flex items-center gap-2 font-bold text-lg text-primary tracking-tight"
			>
				📒 메모알람
			</a>
		</div>

		<div class="flex flex-1 items-center justify-end space-x-1">
			<Button
				variant="ghost"
				size="icon"
				class="rounded-full"
				onclick={() => themeStore.toggle()}
			>
				{#if themeStore.isDark}
					<Sun class="h-4 w-4" />
				{:else}
					<Moon class="h-4 w-4" />
				{/if}
				<span class="sr-only">Toggle theme</span>
			</Button>
		</div>
	</div>
</header>
