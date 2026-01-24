import type { Memo, MemoCreate, MemoUpdate, SyncStatus } from '$lib/types/memo';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { supabase } from '$lib/services/supabase';
import { authStore } from './auth.svelte';
import { isNative, scheduleNotification, cancelNotification } from '$lib/utils/capacitor';
import { toastStore } from './toast.svelte';
import { createMemoAlarm, updateMemoAlarm, deleteMemoAlarms } from '$lib/services/alarmSchedules';

const CACHE_KEY = 'memo-alarm-memos-cache';
const INITIALIZED_KEY = 'memo-alarm-initialized';

const SAMPLE_MEMOS: Omit<Memo, 'id' | 'createdAt' | 'updatedAt'>[] = [
	{
		title: '메모 알람 앱에 오신 것을 환영합니다! 🎉',
		content: '이 앱은 메모와 북마크를 관리하고, 알림을 설정할 수 있는 앱입니다.\n\n키보드 단축키:\n• N: 새 메모 만들기\n• /: 검색 포커스\n• Esc: 모달 닫기',
		tags: ['시작하기', '도움말'],
		isPinned: true,
		isFavorite: false,
		isActive: true
	},
	{
		title: '북마크 예시',
		content: 'URL을 추가하면 북마크로 사용할 수 있습니다.',
		tags: ['예시', '북마크'],
		isPinned: false,
		isFavorite: true,
		isActive: true,
		url: 'https://github.com',
		emoji: '🐙'
	},
	{
		title: '알림 설정하기',
		content: '메모에 알림을 설정하면 지정한 시간에 알림을 받을 수 있습니다.\n편집 버튼을 눌러 알림을 설정해보세요.',
		tags: ['예시', '알림'],
		isPinned: false,
		isFavorite: false,
		isActive: true
	}
];

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateLocalId(): string {
	return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// localStorage 캐시 (오프라인 폴백용)
function loadCacheFromStorage(): Memo[] {
	if (!browser) return [];
	try {
		const cached = localStorage.getItem(CACHE_KEY);
		return cached ? JSON.parse(cached) : [];
	} catch {
		return [];
	}
}

function saveCacheToStorage(memos: Memo[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(memos));
	} catch (e) {
		console.error('Failed to cache memos:', e);
	}
}

// Supabase 타입 변환 함수
function supabaseToMemo(row: any): Memo {
	return {
		id: row.id,
		title: row.title,
		content: row.content || '',
		tags: row.tags || [],
		isPinned: row.is_pinned || false,
		isFavorite: row.is_favorite || false,
		isActive: row.is_active !== false,
		createdAt: new Date(row.created_at).getTime(),
		updatedAt: new Date(row.updated_at).getTime(),
		url: row.url,
		emoji: row.emoji,
		openCount: row.open_count || 0,
		reminder: row.reminder,
		folderId: row.folder_id,
		checklist: row.checklist,
		version: row.version || 1
	};
}

function memoToSupabase(memo: Partial<Memo>): any {
	const result: any = {};
	if (memo.id !== undefined) result.id = memo.id;
	if (memo.title !== undefined) result.title = memo.title;
	if (memo.content !== undefined) result.content = memo.content;
	if (memo.tags !== undefined) result.tags = memo.tags;
	if (memo.isPinned !== undefined) result.is_pinned = memo.isPinned;
	if (memo.isFavorite !== undefined) result.is_favorite = memo.isFavorite;
	if (memo.isActive !== undefined) result.is_active = memo.isActive;
	if (memo.url !== undefined) result.url = memo.url;
	if (memo.emoji !== undefined) result.emoji = memo.emoji;
	if (memo.openCount !== undefined) result.open_count = memo.openCount;
	if (memo.reminder !== undefined) result.reminder = memo.reminder;
	if (memo.folderId !== undefined) result.folder_id = memo.folderId;
	if (memo.checklist !== undefined) result.checklist = memo.checklist;
	return result;
}

function createMemosStore() {
	let memos = $state<Memo[]>([]);
	let loading = $state(true);
	let initialized = $state(false);
	let subscription: RealtimeChannel | null = null;

	async function init() {
		if (initialized) return;

		if (!authStore.isAuthenticated) {
			// 비로그인: localStorage 캐시 읽기 (오프라인)
			memos = loadCacheFromStorage();
			loading = false;
			initialized = true;

			// 샘플 메모 추가 (최초 실행 시)
			if (browser && !localStorage.getItem(INITIALIZED_KEY) && memos.length === 0) {
				const now = Date.now();
				memos = SAMPLE_MEMOS.map((sample, index) => ({
					...sample,
					id: generateId(),
					createdAt: now - index * 60000,
					updatedAt: now - index * 60000
				}));
				saveCacheToStorage(memos);
				localStorage.setItem(INITIALIZED_KEY, 'true');
			}
			return;
		}

		// 로그인: Supabase에서 로드
		await fetchFromSupabase();

		// Realtime 구독
		subscribeToRealtime();

		loading = false;
		initialized = true;
	}

	async function fetchFromSupabase() {
		if (!authStore.user) return;

		try {
			const { data, error } = await supabase
				.from('memos')
				.select('*')
				.eq('user_id', authStore.user.id)
				.order('created_at', { ascending: false });

			if (error) {
				console.error('Failed to load memos:', error);
				toastStore.error('메모 로드 실패');
				memos = loadCacheFromStorage();
			} else {
				memos = (data || []).map((row) => {
					const memo = supabaseToMemo(row);
					memo.syncStatus = 'synced';
					return memo;
				});
				saveCacheToStorage(memos);
			}
		} catch (e) {
			console.error('Failed to fetch memos:', e);
			memos = loadCacheFromStorage();
		}
	}

	function subscribeToRealtime() {
		if (!authStore.user) return;

		subscription = supabase
			.channel('memos')
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'memos',
					filter: `user_id=eq.${authStore.user.id}`
				},
				(payload) => {
					const newMemo = supabaseToMemo(payload.new);
					// Optimistic UI: 이미 로컬에 있으면 교체, 없으면 추가
					const existingIndex = memos.findIndex((m) => m.id === newMemo.id || m.localId === newMemo.id);
					if (existingIndex !== -1) {
						// 이미 있음 → 서버 데이터로 교체 (syncStatus: synced)
						newMemo.syncStatus = 'synced';
						memos = memos.map((m, i) => (i === existingIndex ? newMemo : m));
					} else {
						// 다른 기기에서 추가됨 → 목록에 추가
						newMemo.syncStatus = 'synced';
						memos = [newMemo, ...memos];
					}
					saveCacheToStorage(memos);
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'memos',
					filter: `user_id=eq.${authStore.user.id}`
				},
				(payload) => {
					const updated = supabaseToMemo(payload.new);
					updated.syncStatus = 'synced';
					memos = memos.map((m) => (m.id === updated.id ? updated : m));
					saveCacheToStorage(memos);
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'DELETE',
					schema: 'public',
					table: 'memos',
					filter: `user_id=eq.${authStore.user.id}`
				},
				(payload) => {
					memos = memos.filter((m) => m.id !== payload.old.id);
					saveCacheToStorage(memos);
				}
			)
			.subscribe();
	}

	async function add(data: MemoCreate): Promise<Memo | null> {
		const now = Date.now();
		const localId = generateLocalId();

		if (!authStore.isAuthenticated) {
			// 비로그인: 로컬 전용
			const newMemo: Memo = {
				id: generateId(),
				title: data.title,
				content: data.content || '',
				tags: data.tags || [],
				isPinned: false,
				isFavorite: false,
				isActive: true,
				createdAt: now,
				updatedAt: now,
				url: data.url,
				emoji: data.emoji,
				reminder: data.reminder,
				folderId: data.folderId,
				checklist: data.checklist,
				syncStatus: 'synced' // 로컬 전용은 항상 synced
			};
			memos = [newMemo, ...memos];
			saveCacheToStorage(memos);

			if (newMemo.reminder?.enabled && (await isNative())) {
				scheduleNotification(newMemo);
			}

			return newMemo;
		}

		// 로그인: Optimistic UI 패턴
		// 1. 즉시 로컬에 추가 (pending 상태)
		const optimisticMemo: Memo = {
			id: localId, // 임시 로컬 ID
			localId: localId,
			title: data.title,
			content: data.content || '',
			tags: data.tags || [],
			isPinned: false,
			isFavorite: false,
			isActive: true,
			createdAt: now,
			updatedAt: now,
			url: data.url,
			emoji: data.emoji,
			reminder: data.reminder,
			folderId: data.folderId,
			checklist: data.checklist,
			syncStatus: 'pending'
		};
		memos = [optimisticMemo, ...memos];
		saveCacheToStorage(memos);

		// 2. 백그라운드에서 서버 동기화
		const serverId = generateId();
		const newMemo = memoToSupabase({
			id: serverId,
			...data,
			isPinned: false,
			isFavorite: false,
			isActive: true
		});
		newMemo.user_id = authStore.user!.id;

		const { data: inserted, error } = await supabase
			.from('memos')
			.insert(newMemo)
			.select()
			.single();

		if (error) {
			console.error('Failed to add memo:', error);
			// 동기화 실패: 상태만 failed로 변경
			memos = memos.map((m) =>
				m.localId === localId ? { ...m, syncStatus: 'failed' as SyncStatus } : m
			);
			saveCacheToStorage(memos);
			toastStore.error('메모 동기화 실패. 나중에 다시 시도합니다.');
			return optimisticMemo;
		}

		// 3. 동기화 성공: 서버 ID로 교체 + synced 상태
		const result = supabaseToMemo(inserted);
		result.syncStatus = 'synced';

		// localId로 찾아서 교체 (Realtime에서 중복 추가 방지)
		memos = memos.map((m) => (m.localId === localId ? result : m));
		saveCacheToStorage(memos);

		// 알림 스케줄링 (네이티브: 로컬 알림, 웹: FCM 서버 알림)
		if (result.reminder?.enabled) {
			if (await isNative()) {
				scheduleNotification(result);
			} else {
				// FCM 서버 알림 등록
				try {
					await createMemoAlarm(authStore.user!.id, result.id, result.title, result.reminder);
					console.log('[Alarms] Created memo alarm for:', result.title);
				} catch (alarmError) {
					console.warn('[Alarms] Failed to create alarm:', alarmError);
				}
			}
		}

		return result;
	}

	async function update(id: string, changes: MemoUpdate, options?: { silent?: boolean }): Promise<Memo | null> {
		if (!authStore.isAuthenticated) {
			// 비로그인: 로컬 전용
			const index = memos.findIndex((m) => m.id === id);
			if (index === -1) return null;

			const updated: Memo = {
				...memos[index],
				...changes,
				updatedAt: Date.now()
			};
			memos = [...memos.slice(0, index), updated, ...memos.slice(index + 1)];
			saveCacheToStorage(memos);

			if (await isNative()) {
				if (updated.reminder?.enabled) {
					scheduleNotification(updated);
				} else {
					cancelNotification(id);
				}
			}

			return updated;
		}

		// 로그인: Supabase 업데이트 (충돌 감지)
		const currentMemo = memos.find((m) => m.id === id);
		if (!currentMemo) return null;

		const updateData = memoToSupabase(changes);

		const { data, error } = await supabase
			.from('memos')
			.update(updateData)
			.eq('id', id)
			.eq('version', currentMemo.version) // 버전 기반 충돌 감지
			.select()
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				// 버전 불일치 → 충돌! (silent 모드가 아닐 때만 토스트 표시)
				if (!options?.silent) {
					toastStore.warning('다른 기기에서 수정됨. 최신 데이터로 새로고침합니다.');
				}
				await fetchFromSupabase();
				return null;
			}
			console.error('Failed to update memo:', error);
			if (!options?.silent) {
				toastStore.error('메모 수정 실패');
			}
			return null;
		}

		const result = supabaseToMemo(data);

		// 알림 재스케줄링 (네이티브: 로컬 알림, 웹: FCM 서버 알림)
		if (changes.reminder !== undefined || changes.title !== undefined) {
			if (await isNative()) {
				if (result.reminder?.enabled) {
					scheduleNotification(result);
				} else {
					cancelNotification(id);
				}
			} else {
				// FCM 서버 알림 갱신
				try {
					await updateMemoAlarm(authStore.user!.id, id, result.title, result.reminder);
					console.log('[Alarms] Updated memo alarm for:', result.title);
				} catch (alarmError) {
					console.warn('[Alarms] Failed to update alarm:', alarmError);
				}
			}
		}

		return result;
	}

	async function remove(id: string): Promise<boolean> {
		if (!authStore.isAuthenticated) {
			// 비로그인: 로컬 전용
			const index = memos.findIndex((m) => m.id === id);
			if (index === -1) return false;

			if (await isNative()) {
				cancelNotification(id);
			}

			memos = [...memos.slice(0, index), ...memos.slice(index + 1)];
			saveCacheToStorage(memos);
			return true;
		}

		// 로그인: Supabase 삭제
		if (await isNative()) {
			cancelNotification(id);
		} else {
			// FCM 서버 알림 삭제
			try {
				await deleteMemoAlarms(id);
				console.log('[Alarms] Deleted memo alarms for:', id);
			} catch (alarmError) {
				console.warn('[Alarms] Failed to delete alarms:', alarmError);
			}
		}

		const { error } = await supabase.from('memos').delete().eq('id', id);

		if (error) {
			console.error('Failed to delete memo:', error);
			toastStore.error('메모 삭제 실패');
			return false;
		}

		return true;
	}

	function togglePin(id: string): void {
		const memo = memos.find((m) => m.id === id);
		if (memo) {
			update(id, { isPinned: !memo.isPinned });
		}
	}

	function toggleFavorite(id: string): void {
		const memo = memos.find((m) => m.id === id);
		if (memo) {
			update(id, { isFavorite: !memo.isFavorite });
		}
	}

	function toggleActive(id: string): void {
		const memo = memos.find((m) => m.id === id);
		if (memo) {
			update(id, { isActive: memo.isActive === false ? true : false });
		}
	}

	function setFolder(id: string, folderId: string | undefined): void {
		update(id, { folderId });
	}

	function addOpenHistory(id: string): void {
		const memo = memos.find((m) => m.id === id);
		if (memo) {
			const history = memo.openHistory || [];
			const newHistory = [Date.now(), ...history].slice(0, 10);
			// 열람 이력은 중요하지 않으므로 silent 모드로 업데이트
			update(id, { openHistory: newHistory }, { silent: true });
		}
	}

	function incrementOpenCount(id: string): void {
		const memo = memos.find((m) => m.id === id);
		if (memo) {
			// 열람 횟수 증가는 중요하지 않으므로 silent 모드로 업데이트
			update(id, { openCount: (memo.openCount || 0) + 1 }, { silent: true });
		}
	}

	function getById(id: string): Memo | undefined {
		return memos.find((m) => m.id === id);
	}

	function toggleChecklistItem(memoId: string, itemId: string): void {
		const memo = memos.find((m) => m.id === memoId);
		if (memo?.checklist) {
			const newChecklist = memo.checklist.map((item) =>
				item.id === itemId ? { ...item, completed: !item.completed } : item
			);
			update(memoId, { checklist: newChecklist });
		}
	}

	function getAllTags(): string[] {
		const tagSet = new Set<string>();
		memos.forEach((m) => m.tags.forEach((t) => tagSet.add(t)));
		return Array.from(tagSet).sort();
	}

	async function importMemos(newMemos: Memo[], replace = false): Promise<void> {
		if (!authStore.isAuthenticated) {
			// 비로그인: 로컬 전용
			if (replace) {
				memos = newMemos;
			} else {
				const existingIds = new Set(memos.map((m) => m.id));
				const toAdd = newMemos.filter((m) => !existingIds.has(m.id));
				memos = [...toAdd, ...memos];
			}
			saveCacheToStorage(memos);

			if (await isNative()) {
				memos.filter((m) => m.reminder?.enabled).forEach(scheduleNotification);
			}
			return;
		}

		// 로그인: Supabase에 일괄 삽입
		const memosToInsert = newMemos.map((memo) => ({
			...memoToSupabase(memo),
			user_id: authStore.user!.id
		}));

		const { error } = await supabase.from('memos').insert(memosToInsert);

		if (error) {
			console.error('Failed to import memos:', error);
			toastStore.error('메모 가져오기 실패');
			return;
		}

		toastStore.success(`${newMemos.length}개 메모 가져오기 완료`);
	}

	// 동기화용 (구 버전 호환성)
	function importData(newMemos: Memo[]): void {
		importMemos(newMemos, true);
	}

	function clearAll(): void {
		if (!authStore.isAuthenticated) {
			memos = [];
			saveCacheToStorage(memos);
			return;
		}

		toastStore.error('로그인된 상태에서는 개별 삭제만 가능합니다.');
	}

	function cleanup() {
		subscription?.unsubscribe();
		subscription = null;
	}

	return {
		get memos() {
			return memos;
		},
		get loading() {
			return loading;
		},
		get initialized() {
			return initialized;
		},
		init,
		add,
		update,
		remove,
		togglePin,
		toggleFavorite,
		toggleActive,
		setFolder,
		addOpenHistory,
		incrementOpenCount,
		getById,
		toggleChecklistItem,
		getAllTags,
		importMemos,
		importData,
		clearAll,
		cleanup,
		// 구 API 호환성 (sync용)
		deleteMemo: remove,
		updateMemo: update,
		addMemoWithId: (memo: Memo) => {
			// 동기화용 레거시 함수
			const existing = memos.find((m) => m.id === memo.id);
			if (existing) {
				update(memo.id, memo);
			} else {
				add(memo);
			}
		}
	};
}

export const memosStore = createMemosStore();
