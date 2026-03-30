export interface Folder {
	id: string;
	name: string;
	color: string;
	icon?: string;
	order: number;
	createdAt: number;
}

export interface TagMeta {
	name: string;
	alwaysVisible: boolean;
}

export interface ChecklistItem {
	id: string;
	text: string;
	completed: boolean;
}

export type MemoType = 'note' | 'bookmark' | 'task' | 'todo';
export type Priority = 'low' | 'medium' | 'high';
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TodoStatus = 'pending' | 'completed' | 'skipped';
export type SyncStatus = 'local-only' | 'pending' | 'synced' | 'failed';

export interface Reminder {
	id: string; // 알림 고유 ID
	enabled: boolean;
	time: string; // HH:mm
	days: number[]; // 0-6 (일-토)
	autoOpen: boolean;
	type?: 'repeat' | 'once';
	date?: string; // YYYY-MM-DD for one-time reminders
	datetime?: string; // ISO datetime string (computed for display)
	isDefault?: boolean; // 기본알림 사용 여부 (true: 기본설정 시간 사용, false/undefined: 사용자 지정)
}

// Todo 상기 알림 항목
export interface TodoRemindEntry {
	id: string;
	type: 'time' | 'before_due'; // 'time': 매일 특정 시각, 'before_due': 기한 N분 전
	time?: string; // HH:mm (type='time'일 때)
	minutesBefore?: number; // 기한 전 분 (type='before_due'일 때)
}

// Todo 알람 항목
export interface TodoAlertEntry {
	id: string;
	type: 'datetime' | 'before_due'; // 'datetime': 특정 날짜/시각, 'before_due': 기한 N분 전
	time?: string; // HH:mm (type='datetime'일 때)
	date?: string; // YYYY-MM-DD (type='datetime'일 때)
	minutesBefore?: number; // 기한 전 분 (type='before_due'일 때)
}

// Todo 타이밍 설정 (상기/알람 통합)
export interface TodoTiming {
	// 상기 설정
	useGlobalRemind: boolean; // 앱 전역 상기 시간 사용 여부
	remindTimes: TodoRemindEntry[]; // 개별 상기 시각 배열
	// 알람 설정
	useGlobalAutoAlert: boolean; // 앱 전역 자동알람 사용 여부
	autoAlertBefore?: number; // 기한 전 N분에 자동 알람 (null이면 비활성)
	alertTimes: TodoAlertEntry[]; // 수동 알람 시각 배열
	// 기한 초과 표시
	showOverdue: boolean; // 기본 true
}

// 반복 설정
export interface Recurrence {
	type: 'daily' | 'weekly' | 'monthly' | 'custom';
	interval: number; // 간격 (매 N일/주/월)
	daysOfWeek?: number[]; // 0-6 (주간 반복 시)
	dayOfMonth?: number; // 1-31 (월간 반복 시)
	customInterval?: number; // 사용자 지정 간격 (type='custom'일 때)
	customUnit?: 'day' | 'week' | 'month'; // 사용자 지정 단위 (type='custom'일 때)
	endDate?: string; // YYYY-MM-DD (반복 종료 날짜)
	endAfter?: number; // N회 후 종료
}

// Todo 인스턴스 (반복 할일용)
export interface TodoInstance {
	id: string;
	scheduledDate: string; // YYYY-MM-DD (해당 인스턴스의 일정 날짜)
	status: 'pending' | 'completed' | 'skipped';
	completedAt?: number; // 완료 시각
	skippedAt?: number; // 건너뛴 시각
	skipReason?: string; // 건너뛴 이유
	postponeCount: number; // 이 인스턴스가 미뤄진 횟수
}

// 미루기 기록
export interface PostponeRecord {
	from: string; // YYYY-MM-DD (변경 전 기한)
	to: string; // YYYY-MM-DD (변경 후 기한)
	postponedAt: number; // 미룬 시각
}

// 미루기 정보
export interface PostponeInfo {
	count: number; // 총 미루기 횟수
	originalDueDate?: string; // YYYY-MM-DD (최초 기한)
	maxAllowed?: number; // 최대 허용 횟수 (null이면 무제한)
	history: PostponeRecord[]; // 미루기 이력
}

// Todo URL
export interface TodoUrl {
	id: string; // nanoid 등
	url: string; // https://...
	label?: string; // 선택적 레이블 (표시 이름)
	addedAt: number; // 추가 시각 timestamp
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
	reminder?: Reminder; // deprecated: reminders 배열 사용 권장
	reminders?: Reminder[]; // 다중 알림 지원
	// Phase 7: 폴더
	folderId?: string;
	// Phase 8: 열람 이력
	openHistory?: number[];
	// Phase 12: 체크리스트 & 태스크
	memoType?: MemoType;
	checklist?: ChecklistItem[];
	dueDate?: string; // YYYY-MM-DD
	priority?: Priority;
	// Todo 전용 필드
	todoStatus?: TodoStatus;
	todoPriority?: TodoPriority;
	dueTime?: string; // HH:mm
	todoTiming?: TodoTiming;
	completedAt?: number; // 완료 시각 (timestamp)
	// Phase 3: 반복 할일
	recurrence?: Recurrence;
	todoInstances?: TodoInstance[];
	// Phase 2: 미루기
	postponeInfo?: PostponeInfo;
	// Phase 4: 그룹
	todoGroupId?: string;
	// Todo URL 목록
	todoUrls?: TodoUrl[];
	// Pung (자동삭제) 설정
	autoPung?: boolean; // 펑 활성화 여부 (기본 false)
	pungDelay?: number; // 기한 초과 후 N분 뒤 삭제 (기본 0 = 즉시)
	// Online-First: 버전 관리 (충돌 감지용)
	version?: number;
	// Optimistic UI: 동기화 상태
	syncStatus?: SyncStatus;
	localId?: string; // 서버 ID 확정 전 로컬 임시 ID
	// Phase 16: 이미지 첨부
	images?: string[]; // base64 data URLs
	// Phase 25: 오디오 녹음
	audioUrls?: string[]; // base64 data URLs (WebM/MP4)
	// Phase 21: 메모 잠금
	isLocked?: boolean; // 잠금 여부
	lockHint?: string; // 힌트 (선택)
}

export type MemoCreate = Omit<Memo, 'id' | 'createdAt' | 'updatedAt' | 'isPinned' | 'isFavorite' | 'isActive' | 'openCount' | 'openHistory'>;

export type MemoUpdate = Partial<Omit<Memo, 'id' | 'createdAt'>>;

export interface NotificationHistory {
	id: string; // noti_타임스탬프_랜덤
	memoId: string;
	memoTitle: string; // 발송 시점 스냅샷
	reminderId: string;
	reminderType: 'default' | 'additional';
	channel: 'sw-push' | 'capacitor-local' | 'fcm-push';
	status: 'success' | 'failed' | 'unknown';
	errorMessage?: string;
	sentAt: string; // ISO datetime string
	readAt?: string; // ISO datetime string (P2)
}

export type FilterType = 'all' | 'pinned' | 'favorites' | 'bookmarked' | 'archived';

export type SortType = 'recent' | 'oldest' | 'title' | 'updated';

export type ViewMode = 'grid' | 'list' | 'compact';
