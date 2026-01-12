import { browser } from '$app/environment';
import type { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '$lib/services/supabase';
import { memosStore } from './memos.svelte';
import { foldersStore } from './folders.svelte';
import { toastStore } from './toast.svelte';
import type { Memo, Folder } from '$lib/types/memo';

const LAST_SYNC_KEY = 'memo-alarm-auth-last-sync';

interface AuthState {
	user: User | null;
	session: Session | null;
	loading: boolean;
	syncing: boolean;
	error: string | null;
	initialized: boolean;
	initializing: boolean;
}

function createAuthStore() {
	let state = $state<AuthState>({
		user: null,
		session: null,
		loading: true,
		syncing: false,
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
				await checkAndSyncData(newSession.user.id);
				toastStore.success('로그인되었습니다');
			} else if (event === 'SIGNED_OUT') {
				state.user = null;
				state.session = null;
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

	// 데이터 동기화 확인 및 실행
	async function checkAndSyncData(userId: string) {
		state.syncing = true;
		state.error = null;

		try {
			// 서버 데이터 확인
			const { data: serverData, error: fetchError } = await supabase
				.from('user_data')
				.select('*')
				.eq('user_id', userId)
				.single();

			// PGRST116 = no rows returned (신규 사용자)
			if (fetchError && fetchError.code !== 'PGRST116') {
				throw fetchError;
			}

			const hasLocalData = memosStore.memos.length > 0 || foldersStore.folders.length > 0;
			const hasServerData = serverData?.memos?.length > 0;

			if (hasLocalData && !hasServerData) {
				// 로컬에만 데이터 있음 → 업로드
				await uploadToServer(userId);
				toastStore.success('데이터를 서버에 업로드했습니다');
			} else if (!hasLocalData && hasServerData) {
				// 서버에만 데이터 있음 → 다운로드
				await downloadFromServer(serverData);
				toastStore.success('서버 데이터를 가져왔습니다');
			} else if (hasLocalData && hasServerData) {
				// 양쪽 다 있음 → 최신 것 사용
				const lastSync = getLastSyncTime();
				const serverUpdated = new Date(serverData.updated_at);

				if (!lastSync || serverUpdated > lastSync) {
					await downloadFromServer(serverData);
					toastStore.success('서버 데이터로 동기화했습니다');
				} else {
					await uploadToServer(userId);
					toastStore.success('로컬 데이터로 동기화했습니다');
				}
			}

			setLastSyncTime(new Date());
		} catch (e) {
			state.error = e instanceof Error ? e.message : 'Sync failed';
			toastStore.error(state.error);
			console.error('Sync error:', e);
		} finally {
			state.syncing = false;
		}
	}

	// 서버로 업로드
	async function uploadToServer(userId: string) {
		const { error } = await supabase
			.from('user_data')
			.upsert({
				user_id: userId,
				memos: memosStore.memos,
				folders: foldersStore.folders,
				updated_at: new Date().toISOString()
			}, {
				onConflict: 'user_id'
			});

		if (error) throw error;
	}

	// 서버에서 다운로드
	async function downloadFromServer(serverData: { memos: Memo[]; folders: Folder[] }) {
		if (serverData.memos) {
			memosStore.importData(serverData.memos);
		}
		if (serverData.folders) {
			foldersStore.importData(serverData.folders);
		}
	}

	// 수동 동기화
	async function sync(): Promise<boolean> {
		if (!state.user) {
			toastStore.error('로그인이 필요합니다');
			return false;
		}

		await checkAndSyncData(state.user.id);
		return true;
	}

	// 마지막 동기화 시간 저장
	function setLastSyncTime(date: Date) {
		if (!browser) return;
		localStorage.setItem(LAST_SYNC_KEY, date.toISOString());
	}

	// 마지막 동기화 시간 가져오기
	function getLastSyncTime(): Date | null {
		if (!browser) return null;
		const saved = localStorage.getItem(LAST_SYNC_KEY);
		return saved ? new Date(saved) : null;
	}

	return {
		get user() { return state.user; },
		get session() { return state.session; },
		get loading() { return state.loading; },
		get syncing() { return state.syncing; },
		get error() { return state.error; },
		get isAuthenticated() { return !!state.user; },

		initialize,
		signInWithGoogle,
		signInWithKakao,
		signOut,
		sync
	};
}

export const authStore = createAuthStore();
