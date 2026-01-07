// Phase 14: 동기화 타입 정의

export interface SyncUser {
	id: string;
	syncCode: string;
	deviceName?: string;
	createdAt: number;
	lastSyncAt?: number;
}

export interface SyncData {
	memos: SyncMemo[];
	folders: SyncFolder[];
	lastSyncAt: number;
}

export interface SyncMemo {
	id: string;
	userId: string;
	title: string;
	content: string;
	url?: string;
	emoji?: string;
	tags: string[];
	isPinned: boolean;
	isFavorite: boolean;
	openCount: number;
	folderId?: string;
	checklist?: string;  // JSON string
	reminder?: string;   // JSON string
	createdAt: number;
	updatedAt: number;
	deletedAt?: number;
}

export interface SyncFolder {
	id: string;
	userId: string;
	name: string;
	color: string;
	sortOrder: number;
	createdAt: number;
	updatedAt: number;
	deletedAt?: number;
}

export interface SyncRequest {
	syncCode: string;
	deviceName?: string;
	localData: {
		memos: SyncMemo[];
		folders: SyncFolder[];
		lastSyncAt: number;
	};
}

export interface SyncResponse {
	success: boolean;
	user?: SyncUser;
	data?: SyncData;
	conflicts?: SyncConflict[];
	error?: string;
}

export interface SyncConflict {
	entityType: 'memo' | 'folder';
	entityId: string;
	localVersion: unknown;
	serverVersion: unknown;
	resolution?: 'local' | 'server' | 'merge';
}

export interface SyncStatus {
	isSyncing: boolean;
	lastSyncAt?: number;
	error?: string;
	isOnline: boolean;
}
