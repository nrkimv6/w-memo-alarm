<script lang="ts">
	import { onMount } from "svelte";
	import { onNavigate, goto } from "$app/navigation";
	import { browser } from "$app/environment";
	import "../app.css";
	import type { Snippet } from "svelte";
	import { themeStore } from "$lib/stores/theme.svelte";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { notificationHistoryStore } from "$lib/stores/notificationHistory.svelte";
	import { authStore } from "$lib/stores/auth.svelte";
	import { memosStore } from "$lib/stores/memos.svelte";
	import { filterStore } from "$lib/stores/filter.svelte";
	import { foldersStore } from "$lib/stores/folders.svelte";
	import { registerFCMToken, setupForegroundMessageListener, hasDeactivatedToken, resetFCMToken } from "$lib/fcm";
	import { setupShareIntentListener, shareIntentToQueryParams, type ShareIntentData } from "$lib/utils/capacitor";
	import { Toast } from "$lib/components/ui";
	import UnifiedHeader from "$lib/components/layout/UnifiedHeader.svelte";
	import BottomNav from "$lib/components/BottomNav.svelte";
	import SyncStatusBanner from "$lib/components/SyncStatusBanner.svelte";

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

	// 알림 재설정 필요 여부
	let showNotificationResetAlert = $state(false);

	// FCM 토큰 등록 (로그인 후)
	async function initFCM() {
		if (authStore.isAuthenticated && authStore.user?.id) {
			try {
				// 비활성화된 토큰이 있는지 확인 (서버에서 NotRegistered로 비활성화됨)
				const hasExpiredToken = await hasDeactivatedToken(authStore.user.id);
				if (hasExpiredToken) {
					showNotificationResetAlert = true;
					return; // 사용자가 재설정할 때까지 대기
				}

				const result = await registerFCMToken(authStore.user.id);
				if (result) {
					setupForegroundMessageListener();
				}
			} catch (error) {
				console.error('[Layout] FCM registration error:', error);
			}
		}
	}

	// 알림 재설정 처리
	async function handleResetNotification() {
		if (!authStore.user?.id) return;

		showNotificationResetAlert = false;

		try {
			const result = await resetFCMToken(authStore.user.id);
			if (result) {
				setupForegroundMessageListener();
			}
		} catch (error) {
			console.error('[Layout] FCM reset error:', error);
		}
	}

	// 알림 재설정 무시
	function handleDismissNotificationAlert() {
		showNotificationResetAlert = false;
	}

	// Share Intent 수신 핸들러 (Android Native)
	function handleShareIntent(data: ShareIntentData) {
		// /share 페이지로 리다이렉트 (쿼리 파라미터로 데이터 전달)
		const queryString = shareIntentToQueryParams(data);
		if (queryString) {
			goto(`/share?${queryString}`);
		}
	}

	onMount(async () => {
		themeStore.init();
		settingsStore.init();
		notificationStore.init();
		notificationHistoryStore.init();

		// auth callback 페이지에서는 모든 auth/store 초기화를 callback 페이지에 위임.
		// 이유: Svelte는 자식(callback +page) → 부모(+layout) 순으로 onMount가 실행되므로,
		// layout의 authStore.initialize() → getSession()과
		// callback의 signInWithIdToken()이 동시에 Supabase auth를 호출하게 되어
		// AbortError("signal is aborted without reason") 레이스 컨디션이 발생함.
		// callback 페이지가 signInWithIdToken → initializeWithSession → goto()를 수행하고,
		// 이후 layout이 정상 경로로 stores를 초기화함.
		const isAuthCallback = window.location.pathname.startsWith('/auth/callback');

		if (!isAuthCallback) {
			// authStore 초기화 완료 후 stores 초기화
			await authStore.initialize();
		} else {
			// auth callback 페이지에서는 callback 페이지가 처리
			// 단, 리스너는 여기서 등록 (Supabase lock 해제 후)
			authStore.ensureListenerRegistered();
		}

		// 로그인 성공 플래그 확인 (auth callback에서 설정)
		const loginSuccess = browser && sessionStorage.getItem("login_success") === "true";
		if (loginSuccess) {
			sessionStorage.removeItem("login_success");
			// auth callback → goto() 후 도착 시: 약간의 지연 후 stores 재초기화
			// Supabase lock이 완전히 해제될 때까지 대기
			await new Promise(resolve => setTimeout(resolve, 500));
			// reinit으로 서버에서 데이터 fetch
			await memosStore.reinit();
			await foldersStore.reinit();
		} else {
			// 일반 페이지 로드: 로컬 캐시 먼저 로드
			await memosStore.init();
			foldersStore.init();
		}

		filterStore.init();

		// 메모 로드 완료 후 Service Worker에 알림 스케줄 등록
		notificationStore.registerRemindersToServiceWorker();

		// FCM 등록
		initFCM();

		// Android Share Intent 리스너 설정
		setupShareIntentListener(handleShareIntent);
	});
</script>

<div class="flex flex-col min-h-screen bg-background">
	<UnifiedHeader />
	<main class="flex-1" style="padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));">
		{@render children()}
	</main>
	<SyncStatusBanner />
	<BottomNav />
</div>

<!-- 알림 재설정 필요 Alert -->
{#if showNotificationResetAlert}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="max-w-sm rounded-lg bg-card p-6 shadow-xl">
			<h3 class="mb-2 text-lg font-semibold text-foreground">🔔 알림 재설정 필요</h3>
			<p class="mb-4 text-sm text-muted-foreground">
				알림 토큰이 만료되어 푸시 알림을 받을 수 없습니다.
				알림을 계속 받으려면 재설정이 필요합니다.
			</p>
			<div class="flex justify-end gap-2">
				<button
					onclick={handleDismissNotificationAlert}
					class="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
				>
					나중에
				</button>
				<button
					onclick={handleResetNotification}
					class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
				>
					재설정
				</button>
			</div>
		</div>
	</div>
{/if}

<Toast />
