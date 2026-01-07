import type { Folder } from '$lib/types/memo';

const STORAGE_KEY = 'memo-alarm-folders';

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

function loadFromStorage(): Folder[] {
	if (typeof window === 'undefined') return [];
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		return data ? JSON.parse(data) : [];
	} catch {
		return [];
	}
}

function saveToStorage(folders: Folder[]): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
	} catch (e) {
		console.error('Failed to save folders:', e);
	}
}

function createFoldersStore() {
	let folders = $state<Folder[]>([]);
	let initialized = $state(false);

	function init() {
		if (initialized) return;
		folders = loadFromStorage();
		initialized = true;
	}

	function add(name: string, color?: string): Folder {
		const newFolder: Folder = {
			id: generateId(),
			name,
			color: color || DEFAULT_COLORS[folders.length % DEFAULT_COLORS.length],
			order: folders.length,
			createdAt: Date.now()
		};
		folders = [...folders, newFolder];
		saveToStorage(folders);
		return newFolder;
	}

	function update(id: string, data: Partial<Omit<Folder, 'id' | 'createdAt'>>): Folder | null {
		const index = folders.findIndex((f) => f.id === id);
		if (index === -1) return null;

		const updated: Folder = {
			...folders[index],
			...data
		};
		folders = [...folders.slice(0, index), updated, ...folders.slice(index + 1)];
		saveToStorage(folders);
		return updated;
	}

	function remove(id: string): boolean {
		const index = folders.findIndex((f) => f.id === id);
		if (index === -1) return false;

		folders = [...folders.slice(0, index), ...folders.slice(index + 1)];
		saveToStorage(folders);
		return true;
	}

	function reorder(fromIndex: number, toIndex: number): void {
		const newFolders = [...folders];
		const [moved] = newFolders.splice(fromIndex, 1);
		newFolders.splice(toIndex, 0, moved);

		// Update order property
		folders = newFolders.map((f, i) => ({ ...f, order: i }));
		saveToStorage(folders);
	}

	function getById(id: string): Folder | undefined {
		return folders.find((f) => f.id === id);
	}

	function getSorted(): Folder[] {
		return [...folders].sort((a, b) => a.order - b.order);
	}

	// Phase 14: 동기화용 - ID 지정하여 폴더 추가
	function addFolderWithId(folder: Folder): void {
		const existing = folders.find((f) => f.id === folder.id);
		if (existing) {
			update(folder.id, folder);
		} else {
			folders = [...folders, folder];
			saveToStorage(folders);
		}
	}

	// Phase 14: 동기화용 alias
	function deleteFolder(id: string): boolean {
		return remove(id);
	}

	function updateFolder(id: string, data: Partial<Omit<Folder, 'id' | 'createdAt'>>): Folder | null {
		return update(id, data);
	}

	return {
		get folders() {
			return folders;
		},
		get initialized() {
			return initialized;
		},
		DEFAULT_COLORS,
		init,
		add,
		update,
		remove,
		reorder,
		getById,
		getSorted,
		// Phase 14: 동기화용
		addFolderWithId,
		deleteFolder,
		updateFolder
	};
}

export const foldersStore = createFoldersStore();
