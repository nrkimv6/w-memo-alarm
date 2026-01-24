export interface Folder {
	id: string;
	name: string;
	color: string;
	icon?: string;
	order: number;
	createdAt: number;
}

export interface ChecklistItem {
	id: string;
	text: string;
	completed: boolean;
}

export type MemoType = 'note' | 'bookmark' | 'task';
export type Priority = 'low' | 'medium' | 'high';
export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface Reminder {
	enabled: boolean;
	time: string; // HH:mm
	days: number[]; // 0-6 (일-토)
	autoOpen: boolean;
	type?: 'repeat' | 'once';
	date?: string; // YYYY-MM-DD for one-time reminders
	datetime?: string; // ISO datetime string (computed for display)
}

export interface Memo {
	id: string;
	title: string;
	content: string;
	tags: string[];
	isPinned: boolean;
	isFavorite: boolean;
	isActive: boolean; // Phase 8: 활성/비활성 토글
	createdAt: number;
	updatedAt: number;
	// Phase 3: 북마크 속성
	url?: string;
	emoji?: string;
	openCount?: number;
	// Phase 4: 알림
	reminder?: Reminder;
	// Phase 7: 폴더
	folderId?: string;
	// Phase 8: 열람 이력
	openHistory?: number[];
	// Phase 12: 체크리스트 & 태스크
	memoType?: MemoType;
	checklist?: ChecklistItem[];
	dueDate?: string; // YYYY-MM-DD
	priority?: Priority;
	// Online-First: 버전 관리 (충돌 감지용)
	version?: number;
	// Optimistic UI: 동기화 상태
	syncStatus?: SyncStatus;
	localId?: string; // 서버 ID 확정 전 로컬 임시 ID
}

export type MemoCreate = Omit<Memo, 'id' | 'createdAt' | 'updatedAt' | 'isPinned' | 'isFavorite' | 'isActive' | 'openCount' | 'openHistory'>;

export type MemoUpdate = Partial<Omit<Memo, 'id' | 'createdAt'>>;

export type FilterType = 'all' | 'pinned' | 'favorites' | 'archived';

export type SortType = 'recent' | 'oldest' | 'title' | 'updated';

export type ViewMode = 'grid' | 'list' | 'compact';
