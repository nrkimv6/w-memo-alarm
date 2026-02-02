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
	import { registerFCMToken, setupForegroundMessageListener } from "$lib/fcm";
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

		// 디버그: memosStore.init() 완료 후 상태 확인
		console.log('[Layout] memosStore.init() completed');
		console.log('[Layout] memos count:', memosStore.memos.length);
		console.log('[Layout] memos with reminders:', memosStore.memos.filter(m => m.reminder?.enabled).length);

		// 메모 로드 완료 후 Service Worker에 알림 스케줄 등록
		console.log('[Layout] Calling registerRemindersToServiceWorker...');
		notificationStore.registerRemindersToServiceWorker();

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

<Toast />
