<script lang="ts">
	import { onMount } from "svelte";
	import {
		Sun,
		Moon,
		Bell,
		X,
		Cloud,
		CloudOff,
		RefreshCw,
		AlertTriangle,
		WifiOff,
		Home,
		ChevronDown,
		Globe,
	} from "lucide-svelte";
	import Button from "$lib/components/ui/Button.svelte";
	import { themeStore } from "$lib/stores/theme.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { memosStore } from "$lib/stores/memos.svelte";
	import { networkStatus } from "$lib/services/networkStatus.svelte";
	import { authStore } from "$lib/stores/auth.svelte";
	import { cn } from "$lib/utils";

	// Family Sites 목록
	const FAMILY_SITES = [
		{ name: "기도시간", url: "https://sacred-hours.woory.day", description: "기도 시간 관리" },
		{ name: "명언집", url: "https://gentle-words.woory.day", description: "일일 명언 및 묵상" },
		{ name: "문센 다모아", url: "https://activity.woory.day", description: "문화센터 강좌 검색" },
		{ name: "스크린샷 생성기", url: "https://screenshot.woory.day", description: "모바일 목업 생성" },
		{ name: "메모알람", url: "https://memo.woory.day", description: "메모 및 알림", current: true },
		{ name: "회선 관리", url: "https://line-minder.woory.day", description: "회선 관리" },
		{ name: "우리공방", url: "https://woory.day", description: "전체 도구 모음", isPortal: true },
	];

	let showNotificationBanner = $state(false);
	let dismissed = $state(false);

	onMount(() => {
		if (typeof window !== "undefined" && "Notification" in window) {
			const permission = Notification.permission;
			const wasDismissed = localStorage.getItem("memo-alarm:notification-banner-dismissed");
			showNotificationBanner = permission === "default" && !wasDismissed;
		}
	});

	async function handleRequestPermission() {
		const granted = await notificationStore.requestPermission();
		showNotificationBanner = false;
		if (granted) {
			localStorage.setItem("memo-alarm:notification-banner-dismissed", "true");
		}
	}

	function dismissBanner() {
		dismissed = true;
		showNotificationBanner = false;
		localStorage.setItem("memo-alarm:notification-banner-dismissed", "true");
	}

	// 동기화 상태
	const isOnline = $derived(networkStatus.isOnline);
	const isAuthenticated = $derived(authStore.isAuthenticated);
	const syncingFromServer = $derived(memosStore.syncingFromServer);
	const pendingCount = $derived(memosStore.pendingCount);
	const failedCount = $derived(memosStore.failedCount);
	const localOnlyCount = $derived(memosStore.localOnlyCount);

	const syncState = $derived.by(() => {
		if (!isAuthenticated) return null;
		if (!isOnline) return { type: "offline", label: "오프라인" };
		if (failedCount > 0) return { type: "failed", label: `${failedCount}개 동기화 실패` };
		if (syncingFromServer) return { type: "syncing", label: "동기화 중..." };
		if (pendingCount > 0) return { type: "pending", label: `${pendingCount}개 동기화 중` };
		if (localOnlyCount > 0) return { type: "local", label: "로컬 캐시" };
		return { type: "synced", label: "동기화됨" };
	});

	// Family Sites 드롭다운 상태 (터치 지원)
	let familySitesOpen = $state(false);
	let familySitesRef: HTMLDivElement;

	function toggleFamilySites(e: MouseEvent) {
		e.stopPropagation();
		familySitesOpen = !familySitesOpen;
	}

	function closeFamilySites() {
		familySitesOpen = false;
	}

	// 외부 클릭 시 닫기
	function handleDocumentClick(e: MouseEvent) {
		if (familySitesOpen && familySitesRef && !familySitesRef.contains(e.target as Node)) {
			familySitesOpen = false;
		}
	}

	const syncStateClass = $derived.by(() => {
		if (!syncState) return "";
		switch (syncState.type) {
			case "failed":
				return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
			case "offline":
			case "pending":
				return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
			case "syncing":
			case "local":
				return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
			default:
				return "";
		}
	});
</script>

<svelte:document onclick={handleDocumentClick} />

<!-- Notification Permission Banner -->
{#if showNotificationBanner && !dismissed}
	<div class="bg-primary/10 border-b border-primary/20 px-4 py-2">
		<div class="container flex items-center justify-between gap-4 mx-auto max-w-7xl">
			<div class="flex items-center gap-2 text-sm">
				<Bell class="w-4 h-4 text-primary" />
				<span>알림을 받으려면 권한을 허용해주세요</span>
			</div>
			<div class="flex items-center gap-2">
				<Button variant="default" size="sm" onclick={handleRequestPermission}>
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
	class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
	style="view-transition-name: unified-header;"
>
	<div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<!-- Left: Portal Home -->
		<a
			href="https://woory.day"
			class="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
			title="우리공방 홈"
		>
			<Home class="h-5 w-5" />
		</a>

		<!-- Center: App Logo -->
		<a
			href="/"
			class="flex items-center gap-2 font-bold text-lg text-primary tracking-tight"
		>
			📒 메모알람
		</a>

		<!-- Right: Actions -->
		<div class="flex items-center gap-1">
			<!-- 동기화 상태 아이콘 -->
			{#if syncState && syncState.type !== "synced"}
				<div
					class={cn(
						"flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors",
						syncStateClass
					)}
					title={syncState.label}
				>
					{#if syncState.type === "offline"}
						<WifiOff class="w-3.5 h-3.5" />
					{:else if syncState.type === "failed"}
						<AlertTriangle class="w-3.5 h-3.5" />
					{:else if syncState.type === "syncing" || syncState.type === "pending"}
						<RefreshCw class="w-3.5 h-3.5 animate-spin" />
					{:else if syncState.type === "local"}
						<CloudOff class="w-3.5 h-3.5" />
					{/if}
				</div>
			{:else if syncState?.type === "synced"}
				<div
					class="flex items-center px-1.5 py-1 text-green-600 dark:text-green-400"
					title="서버와 동기화됨"
				>
					<Cloud class="w-4 h-4" />
				</div>
			{/if}

			<!-- 테마 토글 -->
			<Button
				variant="ghost"
				size="icon"
				class="rounded-full w-9 h-9"
				onclick={() => themeStore.toggle()}
			>
				{#if themeStore.isDark}
					<Sun class="h-4 w-4" />
				{:else}
					<Moon class="h-4 w-4" />
				{/if}
				<span class="sr-only">Toggle theme</span>
			</Button>

			<!-- Family Sites Dropdown -->
			<div class="relative" bind:this={familySitesRef}>
				<button
					class="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
					title="Family Sites"
					onclick={toggleFamilySites}
				>
					<Globe class="h-4 w-4" />
				</button>

				<!-- Dropdown -->
				{#if familySitesOpen}
					<div
						class="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95 origin-top-right z-50"
					>
						<div class="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
							Woory Apps
						</div>
						{#each FAMILY_SITES as site}
							<a
								href={site.url}
								onclick={closeFamilySites}
								class={cn(
									"flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground outline-none focus:bg-accent focus:text-accent-foreground",
									site.current && "bg-accent/50"
								)}
							>
								<span class="font-medium">
									{site.name}
									{#if site.current}
										<span class="text-xs text-muted-foreground ml-1">(현재)</span>
									{/if}
									{#if site.isPortal}
										<span class="text-xs text-primary ml-1">Portal</span>
									{/if}
								</span>
								<span class="text-xs text-muted-foreground">{site.description}</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</header>
