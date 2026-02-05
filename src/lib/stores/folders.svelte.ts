import type { Folder } from '$lib/types/memo';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { supabase } from '$lib/services/supabase';
import { authStore } from './auth.svelte';
import { toastStore } from './toast.svelte';

const CACHE_KEY = 'memo-alarm-folders-cache';

const DEFAULT_COLORS = [
	'#ef4444', // red
	'#f97316', // orange
	'#eab308', // yellow
	'#22c55e', // green
	'#06b6d4', // cyan
	'#3b82f6', // blue
	'#8b5cf6', // violet
	'#ec4899', // pink
	'#6b7280', // gray
];

function generateId(): string {
	return `folder-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function loadCacheFromStorage(): Folder[] {
	if (!browser) return [];
	try {
		const cached = localStorage.getItem(CACHE_KEY);
		return cached ? JSON.parse(cached) : [];
	} catch {
		return [];
	}
}

function saveCacheToStorage(folders: Folder[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(folders));
	} catch (e) {
		console.error('Failed to cache folders:', e);
	}
}

function supabaseToFolder(row: any): Folder {
	return {
		id: row.id,
		name: row.name,
		color: row.color,
		order: row.order || 0,
		createdAt: new Date(row.created_at).getTime()
	};
}

function folderToSupabase(folder: Partial<Folder>): any {
	const result: any = {};
	if (folder.id !== undefined) result.id = folder.id;
	if (folder.name !== undefined) result.name = folder.name;
	if (folder.color !== undefined) result.color = folder.color;
	if (folder.order !== undefined) result.order = folder.order;
	return result;
}

function createFoldersStore() {
	let folders = $state<Folder[]>([]);
	let loading = $state(true);
	let initialized = $state(false);
	let subscription: RealtimeChannel | null = null;
	let isReinitializing = false; // reinit() 동시 실행 방지

	// 인증 상태 변경 시 강제 재초기화 (로그인 후 폴더 로드용)
	async function reinit() {
		if (isReinitializing) return; // 동시 호출 방지
		isReinitializing = true;
		try {
			subscription?.unsubscribe();
			subscription = null;
			initialized = false;
			await init();
		} finally {
			isReinitializing = false;
		}
	}

	async function init() {
		if (initialized) return;

		if (!authStore.isAuthenticated) {
			folders = loadCacheFromStorage();
			loading = false;
			initialized = true;
			return;
		}

		await fetchFromSupabase();
		subscribeToRealtime();

		loading = false;
		initialized = true;
	}

	async function fetchFromSupabase() {
		if (!authStore.user) return;

		try {
			const { data, error } = await supabase
				.from('ma_folders')
				.select('*')
				.eq('user_id', authStore.user.id)
				.order('order', { ascending: true });

			if (error) {
				console.error('Failed to load folders:', error);
				toastStore.error('폴더 로드 실패');
				folders = loadCacheFromStorage();
			} else {
				folders = (data || []).map(supabaseToFolder);
				saveCacheToStorage(folders);
			}
		} catch (e) {
			console.error('Failed to fetch folders:', e);
			folders = loadCacheFromStorage();
		}
	}

	function subscribeToRealtime() {
		if (!authStore.user) return;

		subscription = supabase
			.channel('folders')
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'ma_folders',
					filter: `user_id=eq.${authStore.user.id}`
				},
				(payload) => {
					const newFolder = supabaseToFolder(payload.new);
					folders = [...folders, newFolder];
					saveCacheToStorage(folders);
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'ma_folders',
					filter: `user_id=eq.${authStore.user.id}`
				},
				(payload) => {
					const updated = supabaseToFolder(payload.new);
					folders = folders.map((f) => (f.id === updated.id ? updated : f));
					saveCacheToStorage(folders);
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'DELETE',
					schema: 'public',
					table: 'ma_folders',
					filter: `user_id=eq.${authStore.user.id}`
				},
				(payload) => {
					folders = folders.filter((f) => f.id !== payload.old.id);
					saveCacheToStorage(folders);
				}
			)
			.subscribe();
	}

	async function add(name: string, color?: string): Promise<Folder | null> {
		if (!authStore.isAuthenticated) {
			const newFolder: Folder = {
				id: generateId(),
				name,
				color: color || DEFAULT_COLORS[folders.length % DEFAULT_COLORS.length],
				order: folders.length,
				createdAt: Date.now()
			};
			folders = [...folders, newFolder];
			saveCacheToStorage(folders);
			return newFolder;
		}

		const newFolder = folderToSupabase({
			id: generateId(),
			name,
			color: color || DEFAULT_COLORS[folders.length % DEFAULT_COLORS.length],
			order: folders.length
		});
		newFolder.user_id = authStore.user!.id;

		const { data: inserted, error } = await supabase
			.from('ma_folders')
			.insert(newFolder)
			.select()
			.single();

		if (error) {
			console.error('Failed to add folder:', error);
			toastStore.error('폴더 저장 실패');
			return null;
		}

		return supabaseToFolder(inserted);
	}

	async function update(
		id: string,
		data: Partial<Omit<Folder, 'id' | 'createdAt'>>
	): Promise<Folder | null> {
		if (!authStore.isAuthenticated) {
			const index = folders.findIndex((f) => f.id === id);
			if (index === -1) return null;

			const updated: Folder = {
				...folders[index],
				...data
			};
			folders = [...folders.slice(0, index), updated, ...folders.slice(index + 1)];
			saveCacheToStorage(folders);
			return updated;
		}

		const updateData = folderToSupabase(data);

		const { data: result, error } = await supabase
			.from('ma_folders')
			.update(updateData)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('Failed to update folder:', error);
			toastStore.error('폴더 수정 실패');
			return null;
		}

		return supabaseToFolder(result);
	}

	async function remove(id: string): Promise<boolean> {
		if (!authStore.isAuthenticated) {
			const index = folders.findIndex((f) => f.id === id);
			if (index === -1) return false;

			folders = [...folders.slice(0, index), ...folders.slice(index + 1)];
			saveCacheToStorage(folders);
			return true;
		}

		const { error } = await supabase.from('ma_folders').delete().eq('id', id);

		if (error) {
			console.error('Failed to delete folder:', error);
			toastStore.error('폴더 삭제 실패');
			return false;
		}

		return true;
	}

	async function reorder(fromIndex: number, toIndex: number): Promise<void> {
		const newFolders = [...folders];
		const [moved] = newFolders.splice(fromIndex, 1);
		newFolders.splice(toIndex, 0, moved);

		// Update order property
		folders = newFolders.map((f, i) => ({ ...f, order: i }));

		if (!authStore.isAuthenticated) {
			saveCacheToStorage(folders);
			return;
		}

		// Supabase에 순서 업데이트
		const updates = folders.map((f) => ({
			id: f.id,
			order: f.order
		}));

		for (const { id, order } of updates) {
			await supabase.from('ma_folders').update({ order }).eq('id', id);
		}
	}

	function getById(id: string): Folder | undefined {
		return folders.find((f) => f.id === id);
	}

	function getSorted(): Folder[] {
		return [...folders].sort((a, b) => a.order - b.order);
	}

	function importData(newFolders: Folder[]): void {
		folders = newFolders;
		saveCacheToStorage(folders);
	}

	function cleanup() {
		subscription?.unsubscribe();
		subscription = null;
		// 로그아웃 시 폴더 데이터 완전 초기화
		folders = [];
		saveCacheToStorage([]);
		initialized = false;
		loading = true;
	}

	return {
		get folders() {
			return folders;
		},
		get loading() {
			return loading;
		},
		get initialized() {
			return initialized;
		},
		DEFAULT_COLORS,
		init,
		reinit,
		add,
		update,
		remove,
		reorder,
		getById,
		getSorted,
		importData,
		cleanup,
		// 구 API 호환성 (sync용)
		deleteFolder: remove,
		updateFolder: update,
		addFolderWithId: (folder: Folder) => {
			const existing = folders.find((f) => f.id === folder.id);
			if (existing) {
				update(folder.id, folder);
			} else {
				add(folder.name, folder.color);
			}
		}
	};
}

export const foldersStore = createFoldersStore();
