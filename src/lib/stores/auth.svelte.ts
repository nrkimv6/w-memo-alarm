import { browser } from '$app/environment';
import type { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '$lib/services/supabase';
import { memosStore } from './memos.svelte';
import { foldersStore } from './folders.svelte';
import { toastStore } from './toast.svelte';

interface AuthState {
	user: User | null;
	session: Session | null;
	loading: boolean;
	error: string | null;
	initialized: boolean;
	initializing: boolean;
}

function createAuthStore() {
	let state = $state<AuthState>({
		user: null,
		session: null,
		loading: true,
		error: null,
		initialized: false,
		initializing: false
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
			console.log('[Auth] State changed:', event);
			state.session = newSession;
			state.user = newSession?.user || null;

			if (event === 'SIGNED_IN' && newSession?.user) {
				// Store 초기화 (Realtime 구독 시작)
				await memosStore.init();
				await foldersStore.init();
				toastStore.success('로그인되었습니다');
			} else if (event === 'SIGNED_OUT') {
				state.user = null;
				state.session = null;
				// Store 클린업
				memosStore.cleanup();
				foldersStore.cleanup();
				toastStore.info('로그아웃되었습니다');
			}
		});
	}

	// Google 로그인 (Auth Worker 사용)
	async function signInWithGoogle() {
		state.error = null;

		try {
			const returnTo = window.location.pathname;
			const isNative = Capacitor.isNativePlatform();
			const authUrl = `https://auth.woory.day/google?appId=memo-alarm&returnTo=${encodeURIComponent(returnTo)}${isNative ? '&native=true' : ''}`;

			if (isNative) {
				// Native: In-App Browser 사용
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
			const isNative = Capacitor.isNativePlatform();
			const authUrl = `https://auth.woory.day/kakao?appId=memo-alarm&returnTo=${encodeURIComponent(returnTo)}${isNative ? '&native=true' : ''}`;

			if (isNative) {
				// Native: In-App Browser 사용
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
