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

	// 초기화
	async function initialize() {
		if (state.initialized || state.initializing || !browser) {
			return;
		}

		state.initializing = true;

		try {
			const { data: { session: currentSession }, error } = await supabase.auth.getSession();

			if (error) {
				console.error('Auth initialization error:', error);
				state.error = error.message;
			} else if (currentSession) {
				state.session = currentSession;
				state.user = currentSession.user;
			}
		} catch (e) {
			console.error('Auth initialization failed:', e);
			state.error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			state.loading = false;
			state.initialized = true;
			state.initializing = false;
		}

		// 인증 상태 변경 리스너
		supabase.auth.onAuthStateChange(async (event, newSession) => {
			const wasLoggedIn = !!state.user;
			state.session = newSession;
			state.user = newSession?.user || null;

			if (event === 'SIGNED_IN' && newSession?.user) {
				// Store 재초기화 (비인증 모드로 먼저 초기화된 경우에도 서버 데이터 로드)
				await memosStore.reinit();
				await foldersStore.reinit();
				// 실제 로그인(이전에 로그아웃 상태)인 경우에만 토스트 표시
				// 외부 링크 복귀, 페이지 새로고침 등에서는 토스트 미표시
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
				// Store 클린업 (메모/폴더 데이터 + 알림 스케줄 전체 초기화)
				memosStore.cleanup();
				foldersStore.cleanup();
				notificationStore.cleanup();
				toastStore.info('로그아웃되었습니다');
			}
		});
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

	return {
		get user() { return state.user; },
		get session() { return state.session; },
		get loading() { return state.loading; },
		get error() { return state.error; },
		get isAuthenticated() { return !!state.user; },

		initialize,
		signInWithGoogle,
		signInWithKakao,
		signOut
	};
}

export const authStore = createAuthStore();
