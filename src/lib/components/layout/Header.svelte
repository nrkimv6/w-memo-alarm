<script lang="ts">
	import { onMount } from "svelte";
	import { Sun, Moon, Bell, X, Cloud, CloudOff, RefreshCw, AlertTriangle, WifiOff } from "lucide-svelte";
	import Button from "$lib/components/ui/Button.svelte";
	import { themeStore } from "$lib/stores/theme.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { memosStore } from "$lib/stores/memos.svelte";
	import { networkStatus } from "$lib/services/networkStatus.svelte";
	import { authStore } from "$lib/stores/auth.svelte";
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

	// 동기화 상태
	const isOnline = $derived(networkStatus.isOnline);
	const isAuthenticated = $derived(authStore.isAuthenticated);
	const syncingFromServer = $derived(memosStore.syncingFromServer);
	const pendingCount = $derived(memosStore.pendingCount);
	const failedCount = $derived(memosStore.failedCount);
	const localOnlyCount = $derived(memosStore.localOnlyCount);

	// 동기화 상태 표시 여부 및 내용
	const syncState = $derived.by(() => {
		if (!isAuthenticated) return null;
		if (!isOnline) return { type: 'offline', label: '오프라인' };
		if (failedCount > 0) return { type: 'failed', label: `${failedCount}개 동기화 실패` };
		if (syncingFromServer) return { type: 'syncing', label: '동기화 중...' };
		if (pendingCount > 0) return { type: 'pending', label: `${pendingCount}개 동기화 중` };
		if (localOnlyCount > 0) return { type: 'local', label: '로컬 캐시' };
		return { type: 'synced', label: '동기화됨' };
	});
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
	style="view-transition-name: header;"
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
			<!-- 동기화 상태 아이콘 -->
			{#if syncState && syncState.type !== 'synced'}
				<div
					class="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors"
					class:bg-red-100={syncState.type === 'failed'}
					class:text-red-700={syncState.type === 'failed'}
					class:dark:bg-red-900/30={syncState.type === 'failed'}
					class:dark:text-red-400={syncState.type === 'failed'}
					class:bg-amber-100={syncState.type === 'offline' || syncState.type === 'pending'}
					class:text-amber-700={syncState.type === 'offline' || syncState.type === 'pending'}
					class:dark:bg-amber-900/30={syncState.type === 'offline' || syncState.type === 'pending'}
					class:dark:text-amber-400={syncState.type === 'offline' || syncState.type === 'pending'}
					class:bg-blue-100={syncState.type === 'syncing' || syncState.type === 'local'}
					class:text-blue-700={syncState.type === 'syncing' || syncState.type === 'local'}
					class:dark:bg-blue-900/30={syncState.type === 'syncing' || syncState.type === 'local'}
					class:dark:text-blue-400={syncState.type === 'syncing' || syncState.type === 'local'}
					title={syncState.label}
				>
					{#if syncState.type === 'offline'}
						<WifiOff class="w-3.5 h-3.5" />
					{:else if syncState.type === 'failed'}
						<AlertTriangle class="w-3.5 h-3.5" />
					{:else if syncState.type === 'syncing' || syncState.type === 'pending'}
						<RefreshCw class="w-3.5 h-3.5 animate-spin" />
					{:else if syncState.type === 'local'}
						<CloudOff class="w-3.5 h-3.5" />
					{/if}
					<span class="hidden sm:inline">{syncState.label}</span>
				</div>
			{:else if syncState?.type === 'synced'}
				<div
					class="flex items-center gap-1 px-2 py-1 text-xs text-green-600 dark:text-green-400"
					title="서버와 동기화됨"
				>
					<Cloud class="w-3.5 h-3.5" />
				</div>
			{/if}

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
