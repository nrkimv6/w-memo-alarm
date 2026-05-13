<script lang="ts">
	import { onMount, onDestroy } from "svelte";
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
	import { tagMetaStore } from "$lib/stores/tagMeta.svelte";
	import { registerFCMToken, setupForegroundMessageListener, hasDeactivatedToken, resetFCMToken, detectProjectMarkerMismatch } from "$lib/fcm";
	import { setupShareIntentListener, setupNotificationListeners, shareIntentToQueryParams, rescheduleAllNotifications, type ShareIntentData } from "$lib/utils/capacitor";
	import { isSafeOpenUrl } from "$lib/utils/url";
	import { deleteAllMemoAlarmsForUser } from "$lib/services/alarmSchedules";
	import { Toast } from "$lib/components/ui";
	import NotificationScheduleResetModal from "$lib/components/notifications/NotificationScheduleResetModal.svelte";
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

	// 기기별 1회 알림 스케줄 초기화 모달
	const SCHEDULE_RESET_ROLLOUT_CUTOFF = '2026-05-13'; // 이 날짜 이후 가입자는 신규 사용자로 제외
	let notificationScheduleResetOpen = $state(false);
	let notificationScheduleResetGuard = $state(false); // 1회만 평가

	// SW reminder sync 상태
	let lastReminderSyncKey = $state('');
	// 메모 로드 전 controllerchange가 발생하면 true로 set, 로드 완료 후 소모
	let pendingControllerResync = $state(false);

	// SW에 reminders를 전체 재등록하는 공통 helper
	async function syncRemindersToSw(reason: string) {
		if (!browser) return;
		if (!memosStore.initialized || memosStore.loading) return;
		// await 전에 동기적으로 key를 갱신해 $effect 재진입 방지
		lastReminderSyncKey = notificationStore.activeReminderSyncKey;
		console.log(`[Layout] SW reminder sync (${reason})`);
		await notificationStore.registerRemindersToServiceWorker();
	}

	// SW 교체(앱 업데이트) 후 새 SW가 clients.claim() 완료 시 reminders 재등록
	function handleControllerChange() {
		if (!memosStore.initialized || memosStore.loading) {
			// 메모 로드 전이면 pending 플래그만 기록
			pendingControllerResync = true;
		} else {
			syncRemindersToSw('controllerchange');
		}
	}

	// fingerprint 변화 감지 → 전체 재등록 ($effect는 Svelte 5 rune)
	$effect(() => {
		const syncKey = notificationStore.activeReminderSyncKey;
		if (!browser || !memosStore.initialized || memosStore.loading) return;
		if (syncKey === lastReminderSyncKey) return;
		syncRemindersToSw('reminder-change');
	});

	// FCM 토큰 등록 (로그인 후)
	async function initFCM() {
		if (authStore.isAuthenticated && authStore.user?.id) {
			try {
				// sender가 바뀌면 먼저 강제 재등록 (hasDeactivatedToken 검사보다 우선)
				const { mismatch } = detectProjectMarkerMismatch();
				if (mismatch) {
					console.log('[Layout] FCM project marker mismatch — forcing re-registration');
					const result = await resetFCMToken(authStore.user.id);
					if (result) {
						setupForegroundMessageListener();
					}
					return; // mismatch 처리 완료 — 이중 재등록 방지
				}

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

	// 기기별 1회 알림 스케줄 초기화 모달 판별
	function checkNotificationScheduleReset() {
		if (notificationScheduleResetGuard) return;
		notificationScheduleResetGuard = true;

		const userId = authStore.user?.id ?? 'local';
		const localKey = `memo-alarm:notification-schedule-reset:v1:${userId}`;

		// 이미 처리된 기기
		if (localStorage.getItem(localKey)) return;

		// 신규 가입자 제외: created_at이 rollout cutoff 이후이면 플래그만 기록
		if (authStore.user?.created_at) {
			const createdDate = authStore.user.created_at.slice(0, 10);
			if (createdDate >= SCHEDULE_RESET_ROLLOUT_CUTOFF) {
				localStorage.setItem(localKey, 'skipped-new-user');
				return;
			}
		}

		notificationScheduleResetOpen = true;
	}

	function markNotificationScheduleResetDone(reason: string) {
		const userId = authStore.user?.id ?? 'local';
		const localKey = `memo-alarm:notification-schedule-reset:v1:${userId}`;
		localStorage.setItem(localKey, reason);
	}

	async function handleNotificationScheduleReset(): Promise<void> {
		markNotificationScheduleResetDone('done');
		const results: string[] = [];

		// 1. OS 로컬 알림 전체 취소 후 재예약
		try {
			await rescheduleAllNotifications(memosStore.memos);
		} catch {
			results.push('capacitor');
		}

		// 2. SW 메모/할일 스케줄 초기화
		try {
			notificationStore.clearLocalNotificationState();
			await notificationStore.clearAllSchedulesInServiceWorker();
		} catch {
			results.push('service-worker');
		}

		// 3. 서버 alarm_schedules 초기화 (로그인 시)
		if (authStore.user?.id) {
			try {
				await deleteAllMemoAlarmsForUser(authStore.user.id);
			} catch {
				results.push('server');
			}
		}

		// 4. 현재 메모 기준 SW 재등록
		try {
			await notificationStore.registerRemindersToServiceWorker();
		} catch {
			results.push('sw-resync');
		}

		if (results.length > 0) {
			console.warn('[Layout] notification reset partial failure:', results);
		}
	}

	function handleNotificationScheduleResetSkip(): void {
		markNotificationScheduleResetDone('skipped');
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
		// controllerchange 리스너: awaited init보다 먼저 등록해 앱 업데이트 직후 이벤트를 놓치지 않는다
		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
		}

		themeStore.init();
		notificationStore.init();
		notificationHistoryStore.init();

		// auth callback 페이지에서는 store 초기화 스킵.
		// callback은 signInWithIdToken 후 window.location.href로 전체 페이지 리로드하므로,
		// 리로드 후 이 layout이 정상 경로(아래)로 초기화됨.
		const isAuthCallback = window.location.pathname.startsWith('/auth/callback');

		if (!isAuthCallback) {
			await authStore.initialize();
			await settingsStore.init();
			await memosStore.init();
			filterStore.init();
			foldersStore.init();
			tagMetaStore.init();
			await settingsStore.flushPendingRuntimeSync();

			// 메모 로드 완료 후 SW에 알림 스케줄 전체 등록 (1회 보장)
			await syncRemindersToSw('initial-load');

			// 로드 전 발생한 controllerchange 이벤트가 있으면 소모
			if (pendingControllerResync) {
				pendingControllerResync = false;
				await syncRemindersToSw('controllerchange-deferred');
			}

			// 기기별 1회 알림 스케줄 초기화 모달 판별 (auth+memos 초기화 완료 후)
			checkNotificationScheduleReset();
		}

		// FCM 등록
		initFCM();

		// Android Share Intent 리스너 설정
		setupShareIntentListener(handleShareIntent);

		// Capacitor 네이티브 알림 클릭 리스너 설정
		setupNotificationListeners((memoId, url) => {
			// 외부 URL이 있으면 새 탭에서 열기 (http/https 스킴만 허용)
			if (url && isSafeOpenUrl(url)) {
				window.open(url, '_blank');
			}
			// 메모 상세로 이동
			goto(`/?memo=${memoId}`);
		});
	});

	onDestroy(() => {
		if (browser && 'serviceWorker' in navigator) {
			navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
		}
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

<NotificationScheduleResetModal
	bind:open={notificationScheduleResetOpen}
	onConfirm={handleNotificationScheduleReset}
	onSkip={handleNotificationScheduleResetSkip}
/>

<Toast />
