<script lang="ts">
	import { onMount } from "svelte";
	import { onNavigate, goto } from "$app/navigation";
	import "../app.css";
	import type { Snippet } from "svelte";
	import { themeStore } from "$lib/stores/theme.svelte";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
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
					console.log('[Layout] Found deactivated FCM token, showing reset alert');
					showNotificationResetAlert = true;
					return; // 사용자가 재설정할 때까지 대기
				}

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

	// 알림 재설정 처리
	async function handleResetNotification() {
		if (!authStore.user?.id) return;

		showNotificationResetAlert = false;

		try {
			const result = await resetFCMToken(authStore.user.id);
			if (result) {
				console.log('[Layout] FCM token reset successfully');
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
		console.log('[Layout] Share intent received:', data);

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

		// authStore 초기화 완료 후 stores 초기화
		await authStore.initialize();

		// 메모 스토어 초기화 (authStore 상태 확정 후)
		// 로컬 캐시를 즉시 로드하여 새로고침 시에도 메모가 표시됨
		await memosStore.init();
		filterStore.init();
		foldersStore.init();

		// FCM 등록
		initFCM();

		// Android Share Intent 리스너 설정
		setupShareIntentListener(handleShareIntent);
	});
</script>

<div class="min-h-screen bg-background pb-20">
	<UnifiedHeader />
	{@render children()}
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
