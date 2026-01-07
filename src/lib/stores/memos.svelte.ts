import type { Memo, MemoCreate, MemoUpdate } from '$lib/types/memo';
import { isNative, scheduleNotification, cancelNotification } from '$lib/utils/capacitor';

const STORAGE_KEY = 'memo-alarm-memos';
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

function loadFromStorage(): Memo[] {
	if (typeof window === 'undefined') return [];
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		return data ? JSON.parse(data) : [];
	} catch {
		return [];
	}
}

function saveToStorage(memos: Memo[]): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
	} catch (e) {
		console.error('Failed to save memos:', e);
	}
}

function createMemosStore() {
	let memos = $state<Memo[]>([]);
	let initialized = $state(false);

	function init() {
		if (initialized) return;
		memos = loadFromStorage();
		initialized = true;

		// Add sample memos on first run
		if (typeof window !== 'undefined' && !localStorage.getItem(INITIALIZED_KEY)) {
			if (memos.length === 0) {
				const now = Date.now();
				const sampleMemos: Memo[] = SAMPLE_MEMOS.map((sample, index) => ({
					...sample,
					id: generateId(),
					createdAt: now - index * 60000, // Stagger creation times
					updatedAt: now - index * 60000
				}));
				memos = sampleMemos;
				saveToStorage(memos);
			}
			localStorage.setItem(INITIALIZED_KEY, 'true');
		}
	}

	function add(data: MemoCreate): Memo {
		const now = Date.now();
		const newMemo: Memo = {
			id: generateId(),
			title: data.title,
			content: data.content,
			tags: data.tags || [],
			isPinned: false,
			isFavorite: false,
			isActive: true,
			createdAt: now,
			updatedAt: now,
			url: data.url,
			emoji: data.emoji,
			reminder: data.reminder,
			folderId: data.folderId
		};
		memos = [newMemo, ...memos];
		saveToStorage(memos);

		// Schedule native notification if reminder is set
		if (newMemo.reminder?.enabled && isNative()) {
			scheduleNotification(newMemo);
		}

		return newMemo;
	}

	function update(id: string, data: MemoUpdate): Memo | null {
		const index = memos.findIndex((m) => m.id === id);
		if (index === -1) return null;

		const updated: Memo = {
			...memos[index],
			...data,
			updatedAt: Date.now()
		};
		memos = [...memos.slice(0, index), updated, ...memos.slice(index + 1)];
		saveToStorage(memos);

		// Update native notification
		if (isNative()) {
			if (updated.reminder?.enabled) {
				scheduleNotification(updated);
			} else {
				cancelNotification(id);
			}
		}

		return updated;
	}

	function remove(id: string): boolean {
		const index = memos.findIndex((m) => m.id === id);
		if (index === -1) return false;

		// Cancel native notification
		if (isNative()) {
			cancelNotification(id);
		}

		memos = [...memos.slice(0, index), ...memos.slice(index + 1)];
		saveToStorage(memos);
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
			update(id, { openHistory: newHistory });
		}
	}

	function incrementOpenCount(id: string): void {
		const memo = memos.find((m) => m.id === id);
		if (memo) {
			update(id, { openCount: (memo.openCount || 0) + 1 });
		}
	}

	function getById(id: string): Memo | undefined {
		return memos.find((m) => m.id === id);
	}

	function getAllTags(): string[] {
		const tagSet = new Set<string>();
		memos.forEach((m) => m.tags.forEach((t) => tagSet.add(t)));
		return Array.from(tagSet).sort();
	}

	function importMemos(newMemos: Memo[], replace = false): void {
		if (replace) {
			memos = newMemos;
		} else {
			// Merge: skip duplicates by id
			const existingIds = new Set(memos.map((m) => m.id));
			const toAdd = newMemos.filter((m) => !existingIds.has(m.id));
			memos = [...toAdd, ...memos];
		}
		saveToStorage(memos);

		// Schedule notifications for imported memos with reminders
		if (isNative()) {
			memos.filter((m) => m.reminder?.enabled).forEach(scheduleNotification);
		}
	}

	function clearAll(): void {
		memos = [];
		saveToStorage(memos);
	}

	return {
		get memos() {
			return memos;
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
		getAllTags,
		importMemos,
		clearAll
	};
}

export const memosStore = createMemosStore();
