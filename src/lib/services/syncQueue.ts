import type { Memo, SyncStatus } from '$lib/types/memo';
import { supabase } from '$lib/services/supabase';
import { toastStore } from '$lib/stores/toast.svelte';
import { networkStatus } from './networkStatus';

interface QueueItem {
	memo: Memo;
	retryCount: number;
	nextRetryAt: number;
}

// 지수 백오프 설정
const INITIAL_DELAY = 1000; // 1초
const MAX_DELAY = 16000; // 16초
const MAX_RETRIES = 5;

function getRetryDelay(retryCount: number): number {
	const delay = INITIAL_DELAY * Math.pow(2, retryCount);
	return Math.min(delay, MAX_DELAY);
}

class SyncQueue {
	private queue: QueueItem[] = [];
	private isProcessing = false;
	private timeoutId: ReturnType<typeof setTimeout> | null = null;
	private onStatusChange: ((localId: string, status: SyncStatus, serverId?: string) => void) | null = null;
	private userId: string | null = null;
	private networkUnsubscribe: (() => void) | null = null;

	constructor() {
		// 네트워크 상태 변화 감지
		this.networkUnsubscribe = networkStatus.onStatusChange((isOnline) => {
			if (isOnline && this.queue.length > 0) {
				console.log('[SyncQueue] Online - resuming sync');
				toastStore.info('온라인 복구 - 동기화 재개');
				// 모든 대기 항목의 nextRetryAt을 즉시로 변경
				this.queue = this.queue.map((item) => ({
					...item,
					nextRetryAt: Date.now()
				}));
				this.processQueue();
			}
		});
	}

	setUserId(userId: string | null) {
		this.userId = userId;
	}

	setOnStatusChange(callback: (localId: string, status: SyncStatus, serverId?: string) => void) {
		this.onStatusChange = callback;
	}

	add(memo: Memo) {
		// 이미 큐에 있으면 무시
		if (this.queue.some((item) => item.memo.localId === memo.localId)) {
			return;
		}

		this.queue.push({
			memo,
			retryCount: 0,
			nextRetryAt: Date.now()
		});

		this.processQueue();
	}

	private async processQueue() {
		if (this.isProcessing || this.queue.length === 0 || !this.userId) {
			return;
		}

		// 오프라인이면 대기
		if (!networkStatus.isOnline) {
			console.log('[SyncQueue] Offline - waiting for connection');
			return;
		}

		this.isProcessing = true;

		while (this.queue.length > 0) {
			const now = Date.now();
			const item = this.queue[0];

			// 아직 재시도 시간이 안 됐으면 대기
			if (item.nextRetryAt > now) {
				const waitTime = item.nextRetryAt - now;
				this.timeoutId = setTimeout(() => {
					this.timeoutId = null;
					this.processQueue();
				}, waitTime);
				this.isProcessing = false;
				return;
			}

			// 큐에서 제거
			this.queue.shift();

			// 동기화 시도
			const success = await this.syncMemo(item);

			if (!success) {
				if (item.retryCount < MAX_RETRIES) {
					// 재시도 스케줄링
					item.retryCount++;
					item.nextRetryAt = Date.now() + getRetryDelay(item.retryCount);
					this.queue.push(item);
					console.log(`[SyncQueue] Scheduled retry ${item.retryCount}/${MAX_RETRIES} for ${item.memo.localId}`);
				} else {
					// 최대 재시도 초과 → 실패 상태로 남김
					console.error(`[SyncQueue] Max retries exceeded for ${item.memo.localId}`);
					this.onStatusChange?.(item.memo.localId!, 'failed');
					toastStore.error(`"${item.memo.title}" 동기화 실패. 수동으로 재시도해주세요.`);
				}
			}
		}

		this.isProcessing = false;
	}

	private async syncMemo(item: QueueItem): Promise<boolean> {
		const { memo } = item;
		if (!this.userId || !memo.localId) return false;

		try {
			const serverId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

			const { data, error } = await supabase
				.from('memos')
				.insert({
					id: serverId,
					user_id: this.userId,
					title: memo.title,
					content: memo.content,
					tags: memo.tags,
					is_pinned: memo.isPinned,
					is_favorite: memo.isFavorite,
					is_active: memo.isActive,
					url: memo.url,
					emoji: memo.emoji,
					reminder: memo.reminder,
					folder_id: memo.folderId,
					checklist: memo.checklist
				})
				.select()
				.single();

			if (error) {
				console.error('[SyncQueue] Sync failed:', error);
				return false;
			}

			// 성공
			console.log(`[SyncQueue] Synced ${memo.localId} → ${serverId}`);
			this.onStatusChange?.(memo.localId, 'synced', data.id);
			return true;
		} catch (e) {
			console.error('[SyncQueue] Sync error:', e);
			return false;
		}
	}

	// 특정 메모 재시도
	retry(localId: string, memo: Memo) {
		// 기존 항목 제거
		this.queue = this.queue.filter((item) => item.memo.localId !== localId);

		// 새로 추가 (retryCount 리셋)
		this.queue.unshift({
			memo: { ...memo, localId },
			retryCount: 0,
			nextRetryAt: Date.now()
		});

		this.processQueue();
	}

	// 대기 중인 항목 수
	get pendingCount(): number {
		return this.queue.length;
	}

	// 큐만 정리
	clear() {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
		this.queue = [];
		this.isProcessing = false;
	}

	// 완전 정리 (앱 종료 시)
	destroy() {
		this.clear();
		if (this.networkUnsubscribe) {
			this.networkUnsubscribe();
			this.networkUnsubscribe = null;
		}
	}
}

export const syncQueue = new SyncQueue();
