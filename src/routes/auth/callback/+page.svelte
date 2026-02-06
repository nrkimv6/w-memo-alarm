<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { supabase } from "$lib/services/supabase";
	import { authStore } from "$lib/stores/auth.svelte";
	import { memosStore } from "$lib/stores/memos.svelte";
	import { foldersStore } from "$lib/stores/folders.svelte";
	import { filterStore } from "$lib/stores/filter.svelte";
	import { notificationStore } from "$lib/stores/notifications.svelte";
	import { registerFCMToken, setupForegroundMessageListener } from "$lib/fcm";
	import { browser } from "$app/environment";
	import { Loader2 } from "lucide-svelte";

	let error = $state<string | null>(null);
	let status = $state<string>("로그인 처리 중...");

	// Hash fragment에서 토큰 파싱 (네이티브 앱 Intent URL에서 전달)
	function parseHashFragment(): {
		provider?: string;
		access_token?: string;
		id_token?: string;
		refresh_token?: string;
		supabase_access_token?: string;
		supabase_refresh_token?: string;
		returnTo?: string;
	} | null {
		if (!browser) return null;

		const hash = window.location.hash.substring(1);
		if (!hash) return null;

		const params = new URLSearchParams(hash);
		const access_token = params.get("access_token");
		const id_token = params.get("id_token");
		const provider = params.get("provider");
		const refresh_token = params.get("refresh_token");
		const supabase_access_token = params.get("supabase_access_token");
		const supabase_refresh_token = params.get("supabase_refresh_token");
		const returnTo = params.get("returnTo");

		if (access_token || id_token || supabase_access_token) {
			return {
				provider: provider || undefined,
				access_token: access_token || undefined,
				id_token: id_token || undefined,
				refresh_token: refresh_token || undefined,
				supabase_access_token: supabase_access_token || undefined,
				supabase_refresh_token: supabase_refresh_token || undefined,
				returnTo: returnTo || undefined,
			};
		}
		return null;
	}

	// Query parameter에서 메타데이터 파싱 (토큰은 hash에서)
	function parseQueryParams(): {
		provider?: string;
		appId?: string;
		returnTo?: string;
		error?: string;
	} | null {
		if (!browser) return null;

		const searchParams = new URLSearchParams(window.location.search);

		const provider = searchParams.get("provider");
		const appId = searchParams.get("appId");
		const returnTo = searchParams.get("returnTo");
		const errorParam = searchParams.get("error");

		console.log("[Auth Callback] Query metadata:", {
			provider,
			appId,
			returnTo,
			error: errorParam,
		});

		if (errorParam) {
			return { error: errorParam };
		}

		if (provider) {
			return {
				provider,
				appId: appId || undefined,
				returnTo: returnTo || undefined,
			};
		}

		return null;
	}

	onMount(async () => {
		try {
			// 1. Query params에서 메타데이터 확인
			const queryMetadata = parseQueryParams();

			// 2. Hash fragment에서 토큰 확인
			const hashTokens = parseHashFragment();

			// 통합: 메타데이터 우선, 토큰은 hash에서
			const tokens = { ...hashTokens, ...queryMetadata };

			console.log(
				"[Auth Callback] Query metadata:",
				queryMetadata ? "present" : "none"
			);
			console.log(
				"[Auth Callback] Hash tokens:",
				hashTokens ? "present" : "none"
			);

			// 에러 처리
			if (tokens?.error) {
				throw new Error(`인증 오류: ${tokens.error}`);
			}

			if (!tokens?.provider) {
				// 기존 세션 확인 (Supabase가 자동 처리한 경우)
				const {
					data: { session },
					error: authError,
				} = await supabase.auth.getSession();

				if (authError) throw authError;

				if (session) {
					console.log("[Auth Callback] Using existing session");
					const safeReturnTo =
						tokens?.returnTo === "/login" ? "/" : tokens?.returnTo || "/";
					await finishLogin(safeReturnTo, session);
					return;
				}

				throw new Error("로그인 정보를 찾을 수 없습니다.");
			}

			status = "인증 처리 중...";

			// 카카오는 Supabase 토큰 직접 사용 (setSession)
			let session;
			if (tokens.supabase_access_token && tokens.supabase_refresh_token) {
				console.log("[Auth Callback] Using Supabase tokens (Kakao)");
				const { data, error: sessionError } = await supabase.auth.setSession({
					access_token: tokens.supabase_access_token,
					refresh_token: tokens.supabase_refresh_token,
				});
				if (sessionError) {
					console.error("[Auth Callback] setSession error:", sessionError);
					throw sessionError;
				}
				session = data.session;
			} else if (tokens.id_token && tokens.access_token) {
				// 구글은 기존 방식 (signInWithIdToken)
				console.log("[Auth Callback] Using signInWithIdToken (Google)");
				const { data, error: signInError } =
					await supabase.auth.signInWithIdToken({
						provider: "google",
						token: tokens.id_token,
						access_token: tokens.access_token,
					});

				if (signInError) {
					console.error(
						"[Auth Callback] signInWithIdToken error:",
						signInError
					);
					throw signInError;
				}

				session = data.session;
			} else {
				throw new Error("유효한 토큰을 찾을 수 없습니다.");
			}

			if (!session) {
				throw new Error("세션 생성에 실패했습니다.");
			}

			console.log("[Auth Callback] Session created successfully");
			const safeReturnTo =
				tokens.returnTo === "/login" ? "/" : tokens.returnTo || "/";
			await finishLogin(safeReturnTo, session);
		} catch (err) {
			console.error("[Auth Callback] Error:", err);
			error =
				err instanceof Error
					? err.message
					: "로그인 처리 중 오류가 발생했습니다.";
		}
	});

	async function finishLogin(returnTo: string, session: import('@supabase/supabase-js').Session) {
		status = "로그인 완료...";

		// 로그인 성공 플래그 저장
		if (browser) {
			sessionStorage.setItem("login_success", "true");
		}

		// Auth store 초기화: 이미 확보된 세션을 직접 전달.
		// signInWithIdToken/setSession 직후 Supabase 내부 lock 경쟁으로
		// getSession()이 AbortError를 발생시키므로, initialize() 대신 사용.
		authStore.initializeWithSession(session);

		// Supabase 내부 lock이 완전히 해제될 때까지 짧은 지연
		// (signInWithIdToken/setSession 후처리 완료 대기)
		await new Promise(resolve => setTimeout(resolve, 100));

		// 스토어 재초기화: authStore.user가 확정된 후 실행하여
		// init()이 인증된 경로(서버 fetch)를 타도록 보장
		await memosStore.reinit();
		await foldersStore.reinit();
		filterStore.init();

		// 방어: reinit 완료 후 initialized 상태 확인
		if (!memosStore.initialized) {
			console.warn('[Auth Callback] memosStore not initialized after reinit, retrying...');
			await memosStore.reinit();
		}

		// 메모 로드 완료 후 알림 관련 초기화
		notificationStore.registerRemindersToServiceWorker();

		// FCM 초기화 (웹 푸시 알림)
		if (authStore.user?.id) {
			registerFCMToken(authStore.user.id).then((result) => {
				if (result) {
					setupForegroundMessageListener();
				}
			}).catch((err) => {
				console.error('[Auth Callback] FCM registration error:', err);
			});
		}

		// SPA 네비게이션으로 이동 (스토어 초기화 완료 후)
		goto(returnTo, { replaceState: true });
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-background">
	<div class="max-w-sm w-full mx-4 p-8 rounded-xl bg-card shadow-lg border border-border">
		{#if error}
			<div class="text-center">
				<p class="text-red-600 mb-4">{error}</p>
				<a
					href="/"
					class="inline-block px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					홈으로 돌아가기
				</a>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-4">
				<Loader2 class="w-8 h-8 animate-spin text-primary" />
				<p class="text-muted-foreground">{status}</p>
			</div>
		{/if}
	</div>
</div>
