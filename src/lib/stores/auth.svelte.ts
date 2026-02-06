import { browser } from '$app/environment';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '$lib/services/supabase';
import { memosStore } from './memos.svelte';
import { foldersStore } from './folders.svelte';
import { notificationStore } from './notifications.svelte';
import { toastStore } from './toast.svelte';
import { deactivateAllFCMTokens } from '$lib/fcm';

// Capacitor 네이티브 플랫폼 체크 (동적 import로 웹에서도 안전하게 작동)
async function isNativePlatform(): Promise<boolean> {
	if (!browser) return false;
	try {
		const { Capacitor } = await import('@capacitor/core');
		return Capacitor.isNativePlatform();
	} catch {
		return false;
	}
}

interface AuthState {
	user: User | null;
	session: Session | null;
	loading: boolean;
	error: string | null;
	initialized: boolean;
	initializing: boolean;
	hasShownLoginToast: boolean;
}

function createAuthStore() {
	let state = $state<AuthState>({
		user: null,
		session: null,
		loading: true,
		error: null,
		initialized: false,
		initializing: false,
		hasShownLoginToast: false
	});

	let listenerRegistered = false;

	// onAuthStateChange 리스너 등록
	// initialSessionResolve: initialize()가 INITIAL_SESSION까지 대기하기 위한 콜백
	let initialSessionResolve: (() => void) | null = null;

	function registerAuthListener() {
		if (listenerRegistered || !browser) return;
		listenerRegistered = true;

		supabase.auth.onAuthStateChange(async (event, newSession) => {
			console.log('[AuthStore] onAuthStateChange:', event, 'wasLoggedIn:', !!state.user, 'newUser:', newSession?.user?.id);
			const wasLoggedIn = !!state.user;
			state.session = newSession;
			state.user = newSession?.user || null;

			if (event === 'INITIAL_SESSION') {
				// INITIAL_SESSION 시점에 Supabase client 내부 auth 컨텍스트가 확정됨.
				// 이후 DB 쿼리에 올바른 auth 헤더가 포함됨.
				state.loading = false;
				state.initialized = true;
				state.initializing = false;
				initialSessionResolve?.();
				initialSessionResolve = null;
			} else if (event === 'SIGNED_IN' && newSession?.user) {
				// Store 재초기화 (비인증 모드로 먼저 초기화된 경우에도 서버 데이터 로드)
				await memosStore.reinit();
				await foldersStore.reinit();
				// 실제 로그인(이전에 로그아웃 상태)인 경우에만 토스트 표시
				if (!wasLoggedIn && !state.hasShownLoginToast) {
					state.hasShownLoginToast = true;
					toastStore.success('로그인되었습니다');
				}
			} else if (event === 'SIGNED_OUT') {
				// FCM 토큰 비활성화 (user 정보가 사라지기 전에 호출)
				if (state.user?.id) {
					deactivateAllFCMTokens(state.user.id);
				}
				state.user = null;
				state.session = null;
				state.hasShownLoginToast = false;
				memosStore.cleanup();
				foldersStore.cleanup();
				notificationStore.cleanup();
				toastStore.info('로그아웃되었습니다');
			}
		});
	}

	// 초기화: onAuthStateChange의 INITIAL_SESSION 이벤트까지 대기.
	// INITIAL_SESSION 시점에 Supabase client의 auth 컨텍스트가 확정되므로,
	// 이후 DB 쿼리(memosStore.init 등)가 올바른 인증 헤더로 실행됨.
	// 기존 getSession() 방식은 localStorage에서 읽기만 하고 client auth를 설정하지 않아
	// RLS가 적용된 쿼리에서 0건을 반환하는 문제가 있었음.
	async function initialize() {
		if (state.initialized || state.initializing || !browser) {
			return;
		}

		state.initializing = true;

		// 리스너 먼저 등록 (INITIAL_SESSION을 받기 위해)
		const initialSessionPromise = new Promise<void>((resolve) => {
			initialSessionResolve = resolve;
		});
		registerAuthListener();

		// INITIAL_SESSION 이벤트 대기 (타임아웃 5초)
		try {
			await Promise.race([
				initialSessionPromise,
				new Promise<void>((_, reject) =>
					setTimeout(() => reject(new Error('INITIAL_SESSION timeout')), 5000)
				)
			]);
			console.log('[AuthStore] initialize() - INITIAL_SESSION received, user:', state.user?.id);
		} catch (e) {
			console.error('[AuthStore] initialize() - timeout waiting for INITIAL_SESSION');
			state.loading = false;
			state.initialized = true;
			state.initializing = false;
		}
	}

	// Google 로그인 (Auth Worker 사용)
	async function signInWithGoogle() {
		state.error = null;

		try {
			const returnTo = window.location.pathname;
			const isNative = await isNativePlatform();
			const authUrl = `https://auth.woory.day/google?appId=memo-alarm&returnTo=${encodeURIComponent(returnTo)}${isNative ? '&native=true' : ''}`;

			if (isNative) {
				// Native: In-App Browser 사용
				const { Browser } = await import('@capacitor/browser');
				await Browser.open({ url: authUrl });
			} else {
				// Web: 일반 리다이렉트
				window.location.href = authUrl;
			}
		} catch (e) {
			state.error = e instanceof Error ? e.message : 'Login failed';
			toastStore.error(state.error);
		}
	}

	// Kakao 로그인 (Auth Worker 사용)
	async function signInWithKakao() {
		state.error = null;

		try {
			const returnTo = window.location.pathname;
			const isNative = await isNativePlatform();
			const authUrl = `https://auth.woory.day/kakao?appId=memo-alarm&returnTo=${encodeURIComponent(returnTo)}${isNative ? '&native=true' : ''}`;

			if (isNative) {
				// Native: In-App Browser 사용
				const { Browser } = await import('@capacitor/browser');
				await Browser.open({ url: authUrl });
			} else {
				// Web: 일반 리다이렉트
				window.location.href = authUrl;
			}
		} catch (e) {
			state.error = e instanceof Error ? e.message : 'Login failed';
			toastStore.error(state.error);
		}
	}

	// 로그아웃
	async function signOut() {
		state.error = null;

		try {
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
		} catch (e) {
			state.error = e instanceof Error ? e.message : 'Logout failed';
			toastStore.error(state.error);
		}
	}

	// 세션 상태를 Supabase에서 명시적으로 다시 읽어 동기화
	// (onAuthStateChange 타이밍에 의존하지 않고 확실하게 user 상태 반영)
	async function refreshSession() {
		if (!browser) return;
		const { data: { session: currentSession } } = await supabase.auth.getSession();
		if (currentSession) {
			state.session = currentSession;
			state.user = currentSession.user;
		}
	}

	// 이미 확보된 세션으로 직접 초기화 (auth callback 전용)
	// signInWithIdToken/setSession 직후 Supabase 내부 lock 경쟁으로
	// getSession()이 AbortError를 발생시키므로, 세션을 직접 전달받아 설정.
	// onAuthStateChange 리스너는 등록하지 않음 (layout의 정상 경로에서 등록됨).
	function initializeWithSession(session: Session) {
		if (!browser) return;
		state.session = session;
		state.user = session.user;
		state.loading = false;
		state.initialized = true;
		state.initializing = false;
		// 리스너 등록하지 않음 — goto() 후 layout이 일반 페이지 로드 경로로 처리
	}

	return {
		get user() { return state.user; },
		get session() { return state.session; },
		get loading() { return state.loading; },
		get error() { return state.error; },
		get isAuthenticated() { return !!state.user; },

		initialize,
		initializeWithSession,
		ensureListenerRegistered: registerAuthListener,
		refreshSession,
		signInWithGoogle,
		signInWithKakao,
		signOut
	};
}

export const authStore = createAuthStore();
