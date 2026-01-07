import { browser } from '$app/environment';
import type { SyncUser, SyncStatus, SyncMemo, SyncFolder, SyncResponse } from '$lib/types/sync';
import type { Memo, Folder } from '$lib/types/memo';
import { memosStore } from './memos.svelte';
import { foldersStore } from './folders.svelte';
import { toastStore } from './toast.svelte';

const STORAGE_KEY = 'memo-alarm-sync';
const SYNC_INTERVAL = 5 * 60 * 1000; // 5분

interface SyncState {
	user: SyncUser | null;
	status: SyncStatus;
	autoSync: boolean;
}

function createSyncStore() {
	let state = $state<SyncState>({
		user: null,
		status: {
			isSyncing: false,
			isOnline: browser ? navigator.onLine : true
		},
		autoSync: false
	});

	let syncInterval: ReturnType<typeof setInterval> | null = null;

	// 저장된 동기화 정보 로드
	function load() {
		if (!browser) return;
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const data = JSON.parse(saved);
				state.user = data.user || null;
				state.status.lastSyncAt = data.lastSyncAt;
				state.autoSync = data.autoSync ?? false;

				if (state.autoSync && state.user) {
					startAutoSync();
				}
			}
		} catch (e) {
			console.error('Failed to load sync state:', e);
		}
	}

	// 상태 저장
	function save() {
		if (!browser) return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({
				user: state.user,
				lastSyncAt: state.status.lastSyncAt,
				autoSync: state.autoSync
			}));
		} catch (e) {
			console.error('Failed to save sync state:', e);
		}
	}

	// API 호출
	async function apiCall(action: string, data: Record<string, unknown> = {}): Promise<SyncResponse> {
		const response = await fetch('/api/sync', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, ...data })
		});
		return response.json();
	}

	// 새 동기화 코드 생성
	async function register(deviceName?: string): Promise<boolean> {
		state.status.isSyncing = true;
		state.status.error = undefined;

		try {
			const result = await apiCall('register', { deviceName });
			if (result.success && result.user) {
				state.user = result.user;
				save();
				toastStore.success(`동기화 코드: ${result.user.syncCode}`);
				return true;
			}
			state.status.error = result.error;
			return false;
		} catch (e) {
			state.status.error = '등록 실패';
			return false;
		} finally {
			state.status.isSyncing = false;
		}
	}

	// 기존 코드로 연결
	async function connect(syncCode: string): Promise<boolean> {
		state.status.isSyncing = true;
		state.status.error = undefined;

		try {
			const result = await apiCall('connect', { syncCode });
			if (result.success && result.user) {
				state.user = result.user;
				save();
				toastStore.success('동기화 연결됨');
				return true;
			}
			state.status.error = result.error || '잘못된 동기화 코드';
			toastStore.error(state.status.error);
			return false;
		} catch (e) {
			state.status.error = '연결 실패';
			toastStore.error(state.status.error);
			return false;
		} finally {
			state.status.isSyncing = false;
		}
	}

	// 로컬 -> 서버 푸시
	async function push(): Promise<boolean> {
		if (!state.user) return false;

		state.status.isSyncing = true;
		state.status.error = undefined;

		try {
			const memos = memosStore.memos.map(memoToSync);
			const folders = foldersStore.folders.map(folderToSync);

			const result = await apiCall('push', {
				syncCode: state.user.syncCode,
				localData: {
					memos,
					folders,
					lastSyncAt: state.status.lastSyncAt || 0
				}
			});

			if (result.success) {
				state.status.lastSyncAt = result.lastSyncAt || Date.now();
				save();
				return true;
			}
			state.status.error = result.error;
			return false;
		} catch (e) {
			state.status.error = '푸시 실패';
			return false;
		} finally {
			state.status.isSyncing = false;
		}
	}

	// 서버 -> 로컬 풀
	async function pull(): Promise<boolean> {
		if (!state.user) return false;

		state.status.isSyncing = true;
		state.status.error = undefined;

		try {
			const result = await apiCall('pull', {
				syncCode: state.user.syncCode,
				localData: {
					lastSyncAt: state.status.lastSyncAt || 0
				}
			});

			if (result.success && result.data) {
				// 서버 데이터를 로컬에 병합
				for (const syncMemo of result.data.memos) {
					const memo = syncToMemo(syncMemo);
					if (syncMemo.deletedAt) {
						memosStore.deleteMemo(memo.id);
					} else {
						const existing = memosStore.memos.find(m => m.id === memo.id);
						if (existing) {
							memosStore.updateMemo(memo.id, memo);
						} else {
							memosStore.addMemoWithId(memo);
						}
					}
				}

				for (const syncFolder of result.data.folders) {
					const folder = syncToFolder(syncFolder);
					if (syncFolder.deletedAt) {
						foldersStore.deleteFolder(folder.id);
					} else {
						const existing = foldersStore.folders.find(f => f.id === folder.id);
						if (existing) {
							foldersStore.updateFolder(folder.id, folder);
						} else {
							foldersStore.addFolderWithId(folder);
						}
					}
				}

				state.status.lastSyncAt = result.data.lastSyncAt;
				save();
				return true;
			}
			state.status.error = result.error;
			return false;
		} catch (e) {
			state.status.error = '풀 실패';
			return false;
		} finally {
			state.status.isSyncing = false;
		}
	}

	// 전체 동기화 (push + pull)
	async function sync(): Promise<boolean> {
		if (!state.user || state.status.isSyncing) return false;

		const pushResult = await push();
		if (!pushResult) return false;

		const pullResult = await pull();
		if (pullResult) {
			toastStore.success('동기화 완료');
		}
		return pullResult;
	}

	// 자동 동기화 시작
	function startAutoSync() {
		if (syncInterval) return;
		syncInterval = setInterval(() => {
			if (state.user && state.status.isOnline) {
				sync();
			}
		}, SYNC_INTERVAL);
		state.autoSync = true;
		save();
	}

	// 자동 동기화 중지
	function stopAutoSync() {
		if (syncInterval) {
			clearInterval(syncInterval);
			syncInterval = null;
		}
		state.autoSync = false;
		save();
	}

	// 연결 해제
	function disconnect() {
		state.user = null;
		state.status.lastSyncAt = undefined;
		stopAutoSync();
		save();
		toastStore.info('동기화 연결 해제됨');
	}

	// 온라인 상태 감지
	if (browser) {
		window.addEventListener('online', () => {
			state.status.isOnline = true;
			if (state.autoSync && state.user) {
				sync();
			}
		});
		window.addEventListener('offline', () => {
			state.status.isOnline = false;
		});
	}

	// 초기화
	load();

	return {
		get user() { return state.user; },
		get status() { return state.status; },
		get autoSync() { return state.autoSync; },
		get isConnected() { return !!state.user; },
		register,
		connect,
		push,
		pull,
		sync,
		startAutoSync,
		stopAutoSync,
		disconnect
	};
}

// Memo -> SyncMemo 변환
function memoToSync(memo: Memo): SyncMemo {
	return {
		id: memo.id,
		userId: '',
		title: memo.title,
		content: memo.content,
		url: memo.url,
		emoji: memo.emoji,
		tags: memo.tags,
		isPinned: memo.isPinned,
		isFavorite: memo.isFavorite,
		openCount: memo.openCount || 0,
		folderId: memo.folderId,
		checklist: memo.checklist ? JSON.stringify(memo.checklist) : undefined,
		reminder: memo.reminder ? JSON.stringify(memo.reminder) : undefined,
		createdAt: memo.createdAt,
		updatedAt: memo.updatedAt
	};
}

// SyncMemo -> Memo 변환
function syncToMemo(sync: SyncMemo): Memo {
	return {
		id: sync.id,
		title: sync.title,
		content: sync.content,
		url: sync.url,
		emoji: sync.emoji,
		tags: sync.tags || [],
		isPinned: sync.isPinned,
		isFavorite: sync.isFavorite,
		isActive: true,
		openCount: sync.openCount,
		folderId: sync.folderId,
		checklist: sync.checklist ? JSON.parse(sync.checklist) : undefined,
		reminder: sync.reminder ? JSON.parse(sync.reminder) : undefined,
		createdAt: sync.createdAt,
		updatedAt: sync.updatedAt
	};
}

// Folder -> SyncFolder 변환
function folderToSync(folder: Folder): SyncFolder {
	return {
		id: folder.id,
		userId: '',
		name: folder.name,
		color: folder.color,
		sortOrder: folder.order,
		createdAt: folder.createdAt,
		updatedAt: folder.createdAt
	};
}

// SyncFolder -> Folder 변환
function syncToFolder(sync: SyncFolder): Folder {
	return {
		id: sync.id,
		name: sync.name,
		color: sync.color,
		order: sync.sortOrder,
		createdAt: sync.createdAt
	};
}

export const syncStore = createSyncStore();
