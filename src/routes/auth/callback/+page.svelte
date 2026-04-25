<script lang="ts">
	import { onMount } from "svelte";
	import { supabase } from "$lib/services/supabase";
	import { browser } from "$app/environment";
	import { env } from "$env/dynamic/public";
	import { Loader2 } from "lucide-svelte";

	let error = $state<string | null>(null);
	let status = $state<string>("로그인 처리 중...");

	function sanitizeReturnTo(returnTo?: string): string {
		if (!browser || !returnTo) return "/";
		if (returnTo === "/login") return "/";

		try {
			const parsed = new URL(returnTo, window.location.origin);
			if (parsed.origin !== window.location.origin) return "/";
			if (!parsed.pathname.startsWith("/")) return "/";
			return `${parsed.pathname}${parsed.search}${parsed.hash}`;
		} catch {
			return "/";
		}
	}

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

			// NOTE: tokens를 메모리에 복사한 뒤, 주소창 hash(#...)를 즉시 제거해 노출면을 줄인다.
			// query string은 유지해야 하므로 pathname + search로만 교체한다.
			if (browser && hashTokens && window.location.hash) {
				window.history.replaceState(
					{},
					"",
					window.location.pathname + window.location.search
				);
			}

			// NOTE: 토큰 원문(access_token/id_token/refresh_token 등)은 어떤 로그에도 남기지 않는다.
			const hasGoogleTokens = Boolean(tokens?.id_token && tokens?.access_token);
			const hasSupabaseTokens = Boolean(
				tokens?.supabase_access_token && tokens?.supabase_refresh_token
			);
			const swController = navigator.serviceWorker?.controller?.scriptURL ?? null;

			console.log("[Auth Callback] Entry:", {
				provider: tokens?.provider,
				appId: tokens?.appId,
				returnTo: tokens?.returnTo ? tokens.returnTo.slice(0, 50) : undefined,
				error: tokens?.error,
				hasGoogleTokens,
				hasSupabaseTokens,
				online: navigator.onLine,
				swController,
			});

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
					const safeReturnTo = sanitizeReturnTo(tokens?.returnTo);
					await finishLogin(safeReturnTo);
					return;
				}

				throw new Error("로그인 정보를 찾을 수 없습니다.");
			}

			status = "인증 처리 중...";

			// 카카오는 Supabase 토큰 직접 사용 (setSession)
			if (tokens.supabase_access_token && tokens.supabase_refresh_token) {
				console.log("[Auth Callback] Using Supabase tokens (Kakao)");
				const { error: sessionError } = await supabase.auth.setSession({
					access_token: tokens.supabase_access_token,
					refresh_token: tokens.supabase_refresh_token,
				});
				if (sessionError) {
					console.error("[Auth Callback] setSession error:", sessionError);
					throw sessionError;
				}
			} else if (tokens.id_token && tokens.access_token) {
				// 구글은 기존 방식 (signInWithIdToken)
				console.log("[Auth Callback] Using signInWithIdToken (Google)");
				const supabaseOrigin = (() => {
					const supabaseUrl = env.PUBLIC_SUPABASE_URL;
					if (!supabaseUrl) return null;
					try {
						return new URL(supabaseUrl).origin;
					} catch {
						return null;
					}
				})();
				console.log("[Auth Callback] signInWithIdToken begin:", {
					provider: tokens.provider,
					supabaseOrigin,
					pathname: window.location.pathname,
					search: window.location.search,
					online: navigator.onLine,
				});
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

				if (!data.session) {
					throw new Error("세션 생성에 실패했습니다.");
				}
			} else {
				throw new Error("유효한 토큰을 찾을 수 없습니다.");
			}

			console.log("[Auth Callback] Session created successfully");
			const safeReturnTo = sanitizeReturnTo(tokens.returnTo);
			await finishLogin(safeReturnTo);
		} catch (err) {
			const errName = err instanceof Error ? err.name : "unknown";
			const errMessage = err instanceof Error ? err.message : String(err);
			console.error("[Auth Callback] Error:", {
				name: errName,
				message: errMessage,
				online: navigator.onLine,
			});

			// NOTE: 브라우저 fetch-level 실패는 사용자 메시지를 과도하게 기술적으로 만들지 않는다.
			const userMessage = "네트워크 또는 세션 교환 실패";
			error = errMessage.includes("Failed to fetch") ? userMessage : errMessage || userMessage;
		}
	});

	async function finishLogin(returnTo: string) {
		status = "로그인 완료...";

		// 전체 페이지 리로드로 이동.
		// signInWithIdToken 후 Supabase client의 전역 lock이 걸려 있어
		// 같은 페이지 내에서 어떤 Supabase 작업도 AbortError/무한대기 발생.
		// 새 페이지 로드 시 Supabase client가 새로 생성되므로 lock 문제 없음.
		// (새로고침하면 정상 작동하는 것과 동일한 원리)
		window.location.href = returnTo;
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
