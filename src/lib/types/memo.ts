export interface Folder {
	id: string;
	name: string;
	color: string;
	icon?: string;
	order: number;
	createdAt: number;
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
	reminder?: {
		enabled: boolean;
		time: string; // HH:mm
		days: number[]; // 0-6 (일-토)
		autoOpen: boolean;
	};
	// Phase 7: 폴더
	folderId?: string;
	// Phase 8: 열람 이력
	openHistory?: number[];
}

export type MemoCreate = Omit<Memo, 'id' | 'createdAt' | 'updatedAt' | 'isPinned' | 'isFavorite' | 'isActive' | 'openCount' | 'openHistory'>;

export type MemoUpdate = Partial<Omit<Memo, 'id' | 'createdAt'>>;

export type FilterType = 'all' | 'pinned' | 'favorites' | 'archived';

export type SortType = 'recent' | 'oldest' | 'title';

export type ViewMode = 'grid' | 'list';
