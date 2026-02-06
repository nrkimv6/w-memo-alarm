<script lang="ts">
	import { onMount } from "svelte";
	import { supabase } from "$lib/services/supabase";
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
			const safeReturnTo =
				tokens.returnTo === "/login" ? "/" : tokens.returnTo || "/";
			await finishLogin(safeReturnTo);
		} catch (err) {
			console.error("[Auth Callback] Error:", err);
			error =
				err instanceof Error
					? err.message
					: "로그인 처리 중 오류가 발생했습니다.";
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
