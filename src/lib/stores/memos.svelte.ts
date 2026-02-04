import type { Memo, MemoCreate, MemoUpdate, SyncStatus, Reminder } from '$lib/types/memo';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { supabase } from '$lib/services/supabase';
import { authStore } from './auth.svelte';
import { isNative, scheduleNotification, cancelNotification } from '$lib/utils/capacitor';
import { toastStore } from './toast.svelte';
import { createMemoAlarm, updateMemoAlarm, deleteMemoAlarms, syncMemoAlarms } from '$lib/services/alarmSchedules';
import { syncQueue } from '$lib/services/syncQueue';
import { settingsStore } from './settings.svelte';
import { notificationStore } from './notifications.svelte';

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

function generateReminderId(): string {
	return `rem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// 기존 단일 reminder를 reminders 배열로 마이그레이션
function migrateToMultipleReminders(memo: Memo): Memo {
	// 이미 reminders가 있으면 스킵
	if (memo.reminders && memo.reminders.length > 0) {
		return memo;
	}

	// reminder가 있으면 reminders로 변환
	if (memo.reminder) {
		return {
			...memo,
			reminders: [{
				...memo.reminder,
				id: memo.reminder.id || generateReminderId(),
				isDefault: memo.reminder.isDefault ?? true
			}],
			reminder: undefined // 기존 필드 제거
		};
	}

	return memo;
}

// 메모의 알림 목록 가져오기 (하위 호환성 지원)
function getRemindersFromMemo(memo: Memo): Reminder[] {
	if (memo.reminders && memo.reminders.length > 0) {
		return memo.reminders;
	}
	if (memo.reminder) {
		return [{
			...memo.reminder,
			id: memo.reminder.id || generateReminderId()
		}];
	}
	return [];
}

// 기본 알림 가져오기
function getDefaultReminderFromMemo(memo: Memo): Reminder | undefined {
	const reminders = getRemindersFromMemo(memo);
	return reminders.find(r => r.isDefault);
}

// 추가 알림 목록 가져오기
function getAdditionalRemindersFromMemo(memo: Memo): Reminder[] {
	const reminders = getRemindersFromMemo(memo);
	return reminders.filter(r => !r.isDefault);
}

// 동기화 실패 로그 (localStorage에 저장, 사용자에게 토스트 표시하지 않음)
const SYNC_ERROR_LOG_KEY = 'memo-alarm-sync-errors';
function logSyncError(action: string, entityId: string, error: any): void {
	if (!browser) return;
	try {
		const logs = JSON.parse(localStorage.getItem(SYNC_ERROR_LOG_KEY) || '[]');
		logs.push({
			action,
			entityId,
			error: error?.message || String(error),
			code: error?.code,
			timestamp: Date.now()
		});
		// 최근 50건만 유지
		if (logs.length > 50) logs.splice(0, logs.length - 50);
		localStorage.setItem(SYNC_ERROR_LOG_KEY, JSON.stringify(logs));
	} catch {
		// 로깅 실패는 무시
	}
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
	const memo: Memo = {
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
		reminders: row.reminders,
		folderId: row.folder_id,
		checklist: row.checklist,
		memoType: row.memo_type,
		dueDate: row.due_date,
		priority: row.priority,
		// Todo 필드
		todoStatus: row.todo_status,
		todoPriority: row.todo_priority,
		dueTime: row.due_time,
		todoTiming: row.todo_timing,
		completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
		recurrence: row.recurrence,
		todoInstances: row.todo_instances,
		postponeInfo: row.postpone_info,
		todoGroupId: row.todo_group_id,
		version: row.version || 1
	};
	// 자동 마이그레이션: reminder → reminders
	return migrateToMultipleReminders(memo);
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
	if (memo.reminders !== undefined) result.reminders = memo.reminders;
	if (memo.folderId !== undefined) result.folder_id = memo.folderId;
	if (memo.checklist !== undefined) result.checklist = memo.checklist;
	if (memo.memoType !== undefined) result.memo_type = memo.memoType;
	if (memo.dueDate !== undefined) result.due_date = memo.dueDate;
	if (memo.priority !== undefined) result.priority = memo.priority;
	// Todo 필드
	if (memo.todoStatus !== undefined) result.todo_status = memo.todoStatus;
	if (memo.todoPriority !== undefined) result.todo_priority = memo.todoPriority;
	if (memo.dueTime !== undefined) result.due_time = memo.dueTime;
	if (memo.todoTiming !== undefined) result.todo_timing = memo.todoTiming;
	if (memo.completedAt !== undefined) result.completed_at = memo.completedAt ? new Date(memo.completedAt).toISOString() : null;
	if (memo.recurrence !== undefined) result.recurrence = memo.recurrence;
	if (memo.todoInstances !== undefined) result.todo_instances = memo.todoInstances;
	if (memo.postponeInfo !== undefined) result.postpone_info = memo.postponeInfo;
	if (memo.todoGroupId !== undefined) result.todo_group_id = memo.todoGroupId;
	return result;
}

function createMemosStore() {
	let memos = $state<Memo[]>([]);
	let loading = $state(true);
	let initialized = $state(false);
	let syncingFromServer = $state(false);
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

		// 로그인: 캐시 우선 로딩 (Cache-First)
		// 1. 즉시 캐시에서 로드하여 UI 표시 (local-only 상태)
		const cached = loadCacheFromStorage();
		if (cached.length > 0) {
			memos = cached.map((m) => ({
				...m,
				// 로컬 전용 상태 (pending/failed는 유지, 나머지는 local-only)
				syncStatus: (m.syncStatus === 'pending' || m.syncStatus === 'failed')
					? m.syncStatus
					: 'local-only' as SyncStatus
			}));
			loading = false; // 즉시 UI 표시
		}

		// 2. 백그라운드에서 서버 동기화
		syncingFromServer = true;
		await fetchFromSupabase();
		syncingFromServer = false;

		// Realtime 구독
		subscribeToRealtime();

		// SyncQueue 설정
		syncQueue.setUserId(authStore.user?.id || null);
		syncQueue.setOnStatusChange((localId, status, serverId) => {
			if (status === 'synced' && serverId) {
				// 서버 ID로 교체
				memos = memos.map((m) => {
					if (m.localId === localId) {
						return { ...m, id: serverId, syncStatus: 'synced' as SyncStatus, localId: undefined };
					}
					return m;
				});
				saveCacheToStorage(memos);
			} else if (status === 'failed') {
				memos = memos.map((m) =>
					m.localId === localId ? { ...m, syncStatus: 'failed' as SyncStatus } : m
				);
				saveCacheToStorage(memos);
			}
		});

		loading = false;
		initialized = true;
	}

	async function fetchFromSupabase() {
		if (!authStore.user) return;

		try {
			const { data, error } = await supabase
				.from('ma_memos')
				.select('*')
				.eq('user_id', authStore.user.id)
				.order('created_at', { ascending: false });

			if (error) {
				console.error('Failed to load memos:', error);
				toastStore.error('메모 로드 실패');
				// 에러 시 캐시 유지 (이미 local-only로 표시됨)
				if (memos.length === 0) {
					memos = loadCacheFromStorage();
				}
			} else {
				// 서버 데이터와 로컬 pending/failed 메모 병합
				const serverMemos = (data || []).map((row) => {
					const memo = supabaseToMemo(row);
					memo.syncStatus = 'synced';
					return memo;
				});

				// 로컬에만 있는 pending/failed 메모 유지
				const localOnlyMemos = memos.filter(
					(m) =>
						(m.syncStatus === 'pending' || m.syncStatus === 'failed') &&
						m.id?.startsWith('local_')
				);

				memos = [...localOnlyMemos, ...serverMemos];
				saveCacheToStorage(memos);
			}
		} catch (e) {
			console.error('Failed to fetch memos:', e);
			// 에러 시 캐시 유지
			if (memos.length === 0) {
				memos = loadCacheFromStorage();
			}
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
					table: 'ma_memos',
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
					table: 'ma_memos',
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
					table: 'ma_memos',
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

		// 기본 알림 자동 적용 로직
		let reminder = data.reminder;
		if (!reminder && settingsStore.settings.autoReminderOnCreate) {
			const defaultReminder = settingsStore.getDefaultReminder();
			reminder = {
				id: generateReminderId(),
				enabled: defaultReminder.enabled,
				time: defaultReminder.time,
				days: defaultReminder.days,
				autoOpen: defaultReminder.autoOpen,
				type: 'repeat',
				isDefault: true // 기본 알림 사용
			};
		}

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
				reminder: reminder,
				folderId: data.folderId,
				checklist: data.checklist,
				syncStatus: 'synced', // 로컬 전용은 항상 synced
				memoType: data.memoType,
				todoStatus: data.todoStatus,
				todoPriority: data.todoPriority,
				dueDate: data.dueDate,
				dueTime: data.dueTime,
				todoTiming: data.todoTiming,
				completedAt: data.completedAt,
				recurrence: data.recurrence,
				todoInstances: data.todoInstances,
				postponeInfo: data.postponeInfo,
				todoGroupId: data.todoGroupId
			};
			memos = [newMemo, ...memos];
			saveCacheToStorage(memos);

			if (newMemo.reminder?.enabled && (await isNative())) {
				scheduleNotification(newMemo);
			}

			// Todo 알림 스케줄링 (Phase 2)
			if (newMemo.memoType === 'todo') {
				const { scheduleTodoNotifications } = await import('$lib/utils/todoNotifications');
				await scheduleTodoNotifications(newMemo);
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
			reminder: reminder,
			folderId: data.folderId,
			checklist: data.checklist,
			syncStatus: 'pending',
			memoType: data.memoType,
			todoStatus: data.todoStatus,
			todoPriority: data.todoPriority,
			dueDate: data.dueDate,
			dueTime: data.dueTime,
			todoTiming: data.todoTiming,
			completedAt: data.completedAt,
			recurrence: data.recurrence,
			todoInstances: data.todoInstances,
			postponeInfo: data.postponeInfo,
			todoGroupId: data.todoGroupId
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
			.from('ma_memos')
			.insert(newMemo)
			.select()
			.single();

		if (error) {
			console.error('Failed to add memo:', error);
			// 동기화 실패: SyncQueue에 추가하여 자동 재시도
			syncQueue.add(optimisticMemo);
			toastStore.warning('메모 동기화 중... 백그라운드에서 재시도합니다.');
			return optimisticMemo;
		}

		// 3. 동기화 성공: 서버 ID로 교체 + synced 상태
		const result = supabaseToMemo(inserted);
		result.syncStatus = 'synced';

		// localId로 찾아서 교체 (Realtime에서 중복 추가 방지)
		memos = memos.map((m) => (m.localId === localId ? result : m));
		saveCacheToStorage(memos);

		// 알림 스케줄링 (네이티브: 로컬 알림, 웹: FCM 서버 알림 + SW)
		const reminders = getRemindersFromMemo(result);
		const hasEnabledReminders = reminders.some(r => r.enabled);

		if (hasEnabledReminders) {
			if (await isNative()) {
				scheduleNotification(result);
			} else {
				// FCM 서버 알림 등록 (1:N reminders 지원)
				try {
					await syncMemoAlarms(authStore.user!.id, result.id, result.title, reminders);
				} catch (alarmError) {
					console.warn('[Alarms] Failed to sync alarms:', alarmError);
				}
				// Service Worker에 알림 등록 (백그라운드 알림용)
				notificationStore.updateReminderInServiceWorker(result);
			}
		}

		// Todo 알림 스케줄링 (Phase 2)
		if (result.memoType === 'todo') {
			const { scheduleTodoNotifications } = await import('$lib/utils/todoNotifications');
			await scheduleTodoNotifications(result);
		}

		return result;
	}

	async function update(id: string, changes: MemoUpdate, options?: { silent?: boolean }): Promise<Memo | null> {
		const index = memos.findIndex((m) => m.id === id);
		if (index === -1) return null;

		const originalMemo = memos[index];

		// 1. 즉시 로컬에서 업데이트 (낙관적 업데이트)
		const optimisticUpdate: Memo = {
			...originalMemo,
			...changes,
			updatedAt: Date.now()
		};
		memos = [...memos.slice(0, index), optimisticUpdate, ...memos.slice(index + 1)];
		saveCacheToStorage(memos);

		// 알림 스케줄링 (네이티브)
		if (await isNative()) {
			if (optimisticUpdate.reminder?.enabled) {
				scheduleNotification(optimisticUpdate);
			} else {
				cancelNotification(id);
			}
		}

		if (!authStore.isAuthenticated) {
			// 비로그인: 로컬 전용이므로 완료
			return optimisticUpdate;
		}

		// 2. 백그라운드에서 서버 동기화
		const updateData = memoToSupabase(changes);

		const { data, error } = await supabase
			.from('ma_memos')
			.update(updateData)
			.eq('id', id)
			.eq('version', originalMemo.version) // 버전 기반 충돌 감지
			.select()
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				// 버전 불일치 → 충돌! 서버 데이터로 롤백
				if (!options?.silent) {
					toastStore.warning('다른 기기에서 수정됨. 최신 데이터로 새로고침합니다.');
				}
				await fetchFromSupabase();
				return null;
			}
			// 기타 오류: 로컬 저장은 유지, 동기화 실패는 로그만 남김
			console.error('Failed to update memo:', error);
			logSyncError('update', id, error);
			// 낙관적 업데이트 유지 (로컬 데이터는 보존) - 사용자에게 에러 토스트 표시하지 않음
			return optimisticUpdate;
		}

		// 3. 서버 응답으로 최종 업데이트 (version 등 서버에서 관리하는 필드 반영)
		const result = supabaseToMemo(data);
		result.syncStatus = 'synced';
		const currentIndex = memos.findIndex((m) => m.id === id);
		if (currentIndex !== -1) {
			memos = [...memos.slice(0, currentIndex), result, ...memos.slice(currentIndex + 1)];
			saveCacheToStorage(memos);
		}

		// FCM 서버 알림 갱신 (웹) - reminders 배열 지원
		if (changes.reminders !== undefined || changes.reminder !== undefined || changes.title !== undefined) {
			if (!(await isNative())) {
				const reminders = getRemindersFromMemo(result);
				if (reminders.length > 0) {
					syncMemoAlarms(authStore.user!.id, id, result.title, reminders).catch((alarmError) => {
						console.warn('[Alarms] Failed to sync alarms:', alarmError);
					});
				} else {
					deleteMemoAlarms(id).catch((alarmError) => {
						console.warn('[Alarms] Failed to delete alarms:', alarmError);
					});
				}
				// Service Worker에 알림 갱신 (백그라운드 알림용)
				notificationStore.updateReminderInServiceWorker(result);
			}
		}

		// Todo 알림 스케줄링 (Phase 2) - todo 필드가 변경되었을 때
		if (result.memoType === 'todo' && (
			changes.dueDate !== undefined ||
			changes.dueTime !== undefined ||
			changes.todoTiming !== undefined ||
			changes.todoStatus !== undefined ||
			changes.todoPriority !== undefined ||
			changes.title !== undefined
		)) {
			const { scheduleTodoNotifications } = await import('$lib/utils/todoNotifications');
			await scheduleTodoNotifications(result);
		}

		return result;
	}

	async function remove(id: string): Promise<boolean> {
		// 메모 찾기
		const memoIndex = memos.findIndex((m) => m.id === id);
		if (memoIndex === -1) return false;

		const memoToDelete = memos[memoIndex];

		// 알림 취소 (먼저 실행)
		if (await isNative()) {
			cancelNotification(id);
		} else {
			// Service Worker에서 알림 제거
			notificationStore.removeReminderFromServiceWorker(id);

			if (authStore.isAuthenticated) {
				// FCM 서버 알림 삭제 (백그라운드)
				deleteMemoAlarms(id).catch((alarmError) => {
					console.warn('[Alarms] Failed to delete alarms:', alarmError);
				});
			}
		}

		// Todo 알림 취소 (Phase 2)
		if (memoToDelete.memoType === 'todo') {
			const { cancelTodoNotifications } = await import('$lib/utils/todoNotifications');
			await cancelTodoNotifications(id);
		}

		// 1. 즉시 로컬에서 제거 (낙관적 업데이트)
		memos = [...memos.slice(0, memoIndex), ...memos.slice(memoIndex + 1)];
		saveCacheToStorage(memos);

		if (!authStore.isAuthenticated) {
			// 비로그인: 로컬 전용이므로 완료
			return true;
		}

		// 2. 백그라운드에서 서버 삭제
		const { error } = await supabase.from('ma_memos').delete().eq('id', id);

		if (error) {
			console.error('Failed to delete memo:', error);
			// 롤백: 삭제 실패 시 복원
			memos = [...memos.slice(0, memoIndex), memoToDelete, ...memos.slice(memoIndex)];
			saveCacheToStorage(memos);
			toastStore.error('메모 삭제 실패 - 복원됨');
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

		const { error } = await supabase.from('ma_memos').insert(memosToInsert);

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

	// 실패한 메모 재시도 (SyncQueue 사용)
	function retrySync(localId: string): boolean {
		if (!authStore.isAuthenticated || !authStore.user) return false;

		const memo = memos.find((m) => m.localId === localId || m.id === localId);
		if (!memo || memo.syncStatus !== 'failed') return false;

		// pending 상태로 변경
		memos = memos.map((m) =>
			m.localId === localId || m.id === localId
				? { ...m, syncStatus: 'pending' as SyncStatus }
				: m
		);
		saveCacheToStorage(memos);

		// SyncQueue에 재시도 요청
		syncQueue.retry(localId, memo);
		toastStore.info('동기화 재시도 중...');

		return true;
	}

	async function updateDefaultReminderMemos(newTime: string, newDays: number[], newAutoOpen: boolean): Promise<void> {
		// isDefault가 true인 알림이 있는 메모들을 찾아서 일괄 업데이트
		const memosWithDefaultReminder = memos.filter((m) => {
			const reminders = getRemindersFromMemo(m);
			return reminders.some(r => r.isDefault === true);
		});

		if (memosWithDefaultReminder.length === 0) {
			return;
		}

		// 각 메모를 업데이트 (로컬 + 서버)
		for (const memo of memosWithDefaultReminder) {
			const reminders = getRemindersFromMemo(memo);
			const updatedReminders = reminders.map(r => {
				if (r.isDefault) {
					return {
						...r,
						time: newTime,
						days: newDays,
						autoOpen: newAutoOpen
					};
				}
				return r;
			});

			await update(memo.id, { reminders: updatedReminders }, { silent: true });
		}

		toastStore.success(`${memosWithDefaultReminder.length}개 메모의 알림 시간이 변경되었습니다.`);
	}

	// 알림 추가
	async function addReminder(memoId: string, reminder: Omit<Reminder, 'id'>): Promise<boolean> {
		const memo = memos.find(m => m.id === memoId);
		if (!memo) return false;

		const newReminder: Reminder = {
			...reminder,
			id: generateReminderId()
		};

		const currentReminders = getRemindersFromMemo(memo);
		const result = await update(memoId, {
			reminders: [...currentReminders, newReminder]
		});

		return !!result;
	}

	// 알림 수정
	async function updateReminder(
		memoId: string,
		reminderId: string,
		changes: Partial<Reminder>
	): Promise<boolean> {
		const memo = memos.find(m => m.id === memoId);
		if (!memo) return false;

		const reminders = getRemindersFromMemo(memo);
		const updatedReminders = reminders.map(r =>
			r.id === reminderId ? { ...r, ...changes } : r
		);

		const result = await update(memoId, { reminders: updatedReminders });
		return !!result;
	}

	// 알림 삭제
	async function removeReminder(memoId: string, reminderId: string): Promise<boolean> {
		const memo = memos.find(m => m.id === memoId);
		if (!memo) return false;

		const reminders = getRemindersFromMemo(memo);
		const filteredReminders = reminders.filter(r => r.id !== reminderId);

		const result = await update(memoId, { reminders: filteredReminders });
		return !!result;
	}

	// 알림 활성화 상태 변경
	async function updateReminderEnabled(
		memoId: string,
		reminderId: string,
		enabled: boolean
	): Promise<boolean> {
		return updateReminder(memoId, reminderId, { enabled });
	}

	// 메모의 알림 목록 가져오기
	function getReminders(memoId: string): Reminder[] {
		const memo = memos.find(m => m.id === memoId);
		if (!memo) return [];
		return getRemindersFromMemo(memo);
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
		syncQueue.clear();
	}

	// Todo 전역 설정 일괄 업데이트
	async function updateGlobalRemindTodos(time: string): Promise<void> {
		const todosWithGlobalRemind = memos.filter(
			m => m.memoType === 'todo' && m.todoTiming?.useGlobalRemind
		);

		// Phase 2: 알림 재스케줄
		const { rescheduleAllTodosForGlobalRemind } = await import('$lib/utils/todoNotifications');
		await rescheduleAllTodosForGlobalRemind(todosWithGlobalRemind, time);
	}

	async function updateGlobalAutoAlertTodos(minutesBefore: number): Promise<void> {
		const todosWithGlobalAutoAlert = memos.filter(
			m => m.memoType === 'todo' && m.todoTiming?.useGlobalAutoAlert
		);

		// Phase 2: 알림 재스케줄
		const { rescheduleAllTodosForGlobalAutoAlert } = await import('$lib/utils/todoNotifications');
		await rescheduleAllTodosForGlobalAutoAlert(todosWithGlobalAutoAlert, minutesBefore);
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
		get syncingFromServer() {
			return syncingFromServer;
		},
		get pendingCount() {
			return memos.filter((m) => m.syncStatus === 'pending').length;
		},
		get failedCount() {
			return memos.filter((m) => m.syncStatus === 'failed').length;
		},
		get localOnlyCount() {
			return memos.filter((m) => m.syncStatus === 'local-only').length;
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
		retrySync,
		updateDefaultReminderMemos,
		updateGlobalRemindTodos,
		updateGlobalAutoAlertTodos,
		// 알림 관련 메서드
		addReminder,
		updateReminder,
		removeReminder,
		updateReminderEnabled,
		getReminders,
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
