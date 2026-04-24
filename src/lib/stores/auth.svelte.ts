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
	// 주의: 콜백 안에서 Supabase DB 쿼리를 await하면 deadlock 발생.
	// reinit()은 setTimeout으로 분리하여 콜백을 즉시 반환해야 함.
	function registerAuthListener() {
		if (listenerRegistered || !browser) return;
		listenerRegistered = true;

		supabase.auth.onAuthStateChange((event, newSession) => {
			console.log('[AuthStore] onAuthStateChange:', event, 'wasLoggedIn:', !!state.user, 'newUser:', newSession?.user?.id);
			const wasLoggedIn = !!state.user;
			state.session = newSession;
			state.user = newSession?.user || null;

			if (event === 'SIGNED_IN' && newSession?.user) {
				// 콜백 안에서 await하면 Supabase client lock으로 deadlock 발생.
				// setTimeout으로 분리하여 콜백을 즉시 반환 → lock 해제 후 DB 쿼리 실행.
				if (!wasLoggedIn) {
					setTimeout(async () => {
						const { settingsStore } = await import('./settings.svelte');
						await settingsStore.reinit();
						await memosStore.reinit();
						await foldersStore.reinit();
					}, 0);
				}
				if (!wasLoggedIn && !state.hasShownLoginToast) {
					state.hasShownLoginToast = true;
					toastStore.success('로그인되었습니다');
				}
			} else if (event === 'SIGNED_OUT') {
				const previousUserId = state.user?.id;
				if (previousUserId) {
					deactivateAllFCMTokens(previousUserId);
				}
				state.user = null;
				state.session = null;
				state.hasShownLoginToast = false;
				void import('./settings.svelte').then(({ settingsStore }) => settingsStore.cleanup());
				memosStore.cleanup();
				foldersStore.cleanup();
				notificationStore.cleanup();
				toastStore.info('로그아웃되었습니다');
			}
		});
	}

	// 초기화: getUser()로 서버에서 토큰 검증 + auth 컨텍스트 확정.
	// getSession()은 localStorage에서만 읽고 Supabase client auth 헤더를 설정하지 않음.
	// getUser()는 서버 API 호출 → 응답 시 client auth 컨텍스트가 확정됨 → 이후 DB 쿼리 인증됨.
	async function initialize() {
		if (state.initialized || state.initializing || !browser) {
			return;
		}

		state.initializing = true;

		try {
			console.log('[AuthStore] initialize() - calling getUser()');
			const { data: { user }, error } = await supabase.auth.getUser();
			console.log('[AuthStore] initialize() - getUser result:', { userId: user?.id, error: error?.message });

			if (error) {
				console.error('Auth initialization error:', error);
				state.error = error.message;
			} else if (user) {
				state.user = user;
				// getUser() 성공 후 세션도 읽어서 설정
				const { data: { session } } = await supabase.auth.getSession();
				state.session = session;
			}
		} catch (e) {
			console.error('Auth initialization failed:', e);
			state.error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			state.loading = false;
			state.initialized = true;
			state.initializing = false;
		}

		// 리스너는 초기화 완료 후 등록 (이후 auth 변경 감지용)
		registerAuthListener();
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
