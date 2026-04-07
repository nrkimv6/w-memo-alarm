/**
 * Supabase DB 행 ↔ Memo 타입 변환 서비스
 */

import type { Memo } from '$lib/types/memo';
import { migrateToMultipleReminders } from '$lib/utils/reminderHelpers';

// Supabase DB 행 타입 (supabase_to_memo 매핑용)
export interface SupabaseMemoRow {
	id: string;
	title: string;
	content?: string;
	tags?: string[];
	is_pinned?: boolean;
	is_favorite?: boolean;
	is_active?: boolean;
	created_at: string;
	updated_at: string;
	url?: string;
	emoji?: string;
	open_count?: number;
	reminder?: unknown;
	reminders?: unknown;
	folder_id?: string;
	checklist?: unknown;
	memo_type?: string;
	due_date?: string;
	priority?: string;
	todo_status?: string;
	todo_priority?: string;
	due_time?: string;
	todo_timing?: unknown;
	completed_at?: string;
	recurrence?: unknown;
	todo_instances?: unknown;
	postpone_info?: unknown;
	todo_group_id?: string;
	todo_urls?: unknown;
	auto_pung?: boolean;
	pung_delay?: number;
	version?: number;
	[key: string]: unknown;
}

// Supabase ↔ Memo 필드 매핑 설정
export interface FieldMapping {
	memo: string;
	db: string;
	toMemo?: (val: unknown) => unknown;
	toDb?: (val: unknown) => unknown;
}

export const MEMO_FIELD_MAPPINGS: FieldMapping[] = [
	{ memo: 'id', db: 'id' },
	{ memo: 'title', db: 'title' },
	{ memo: 'content', db: 'content', toMemo: (v) => v || '' },
	{ memo: 'tags', db: 'tags', toMemo: (v) => v || [] },
	{ memo: 'isPinned', db: 'is_pinned', toMemo: (v) => v || false },
	{ memo: 'isFavorite', db: 'is_favorite', toMemo: (v) => v || false },
	{ memo: 'isActive', db: 'is_active', toMemo: (v) => v !== false },
	{ memo: 'createdAt', db: 'created_at', toMemo: (v) => new Date(v as string).getTime(), toDb: (v) => v ? new Date(v as number).toISOString() : null },
	{ memo: 'updatedAt', db: 'updated_at', toMemo: (v) => new Date(v as string).getTime(), toDb: (v) => v ? new Date(v as number).toISOString() : null },
	{ memo: 'url', db: 'url' },
	{ memo: 'emoji', db: 'emoji' },
	{ memo: 'openCount', db: 'open_count', toMemo: (v) => v || 0 },
	{ memo: 'reminder', db: 'reminder' },
	{ memo: 'reminders', db: 'reminders' },
	{ memo: 'folderId', db: 'folder_id' },
	{ memo: 'checklist', db: 'checklist' },
	{ memo: 'memoType', db: 'memo_type' },
	{ memo: 'dueDate', db: 'due_date' },
	{ memo: 'priority', db: 'priority' },
	{ memo: 'todoStatus', db: 'todo_status' },
	{ memo: 'todoPriority', db: 'todo_priority' },
	{ memo: 'dueTime', db: 'due_time' },
	{ memo: 'todoTiming', db: 'todo_timing' },
	{
		memo: 'completedAt', db: 'completed_at',
		toMemo: (v) => v ? new Date(v as string).getTime() : undefined,
		toDb: (v) => v ? new Date(v as number).toISOString() : null
	},
	{ memo: 'recurrence', db: 'recurrence' },
	{ memo: 'todoInstances', db: 'todo_instances' },
	{ memo: 'postponeInfo', db: 'postpone_info' },
	{ memo: 'todoGroupId', db: 'todo_group_id' },
	{ memo: 'todoUrls', db: 'todo_urls', toMemo: (v) => v || [] },
	{ memo: 'autoPung', db: 'auto_pung', toMemo: (v) => v || false },
	{ memo: 'pungDelay', db: 'pung_delay', toMemo: (v) => v || 0 },
	{ memo: 'version', db: 'version', toMemo: (v) => v || 1 },
];

// 매핑 기반 타입 변환 함수
export function supabaseToMemo(row: SupabaseMemoRow): Memo {
	const memo = {} as Record<string, unknown>;
	for (const { memo: key, db, toMemo } of MEMO_FIELD_MAPPINGS) {
		memo[key] = toMemo ? toMemo(row[db]) : row[db];
	}
	return migrateToMultipleReminders(memo as unknown as Memo);
}

export function memoToSupabase(memo: Partial<Memo>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const memoRecord = memo as Record<string, unknown>;
	for (const { memo: key, db, toDb } of MEMO_FIELD_MAPPINGS) {
		if (!(key in memoRecord)) continue; // 필드 부재 → 스킵
		const val = memoRecord[key];
		if (val === undefined) {
			result[db] = null; // 명시적 undefined → DB에 null 전송
		} else {
			result[db] = toDb ? toDb(val) : val;
		}
	}
	return result;
}
