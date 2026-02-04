<script lang="ts">
	import type { Memo } from '$lib/types/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { getNextOccurrence, getRecurrenceDescription } from '$lib/utils/recurrence';
	import { X, SkipForward } from 'lucide-svelte';

	interface Props {
		todo: Memo;
		onClose: () => void;
	}

	let { todo, onClose }: Props = $props();

	let skipReason = $state('');
	let submitting = $state(false);

	// 현재 활성 인스턴스 찾기
	const activeInstance = $derived(
		todo.todoInstances?.find(i => i.status === 'pending')
	);

	// 다음 일정 계산
	const nextSchedule = $derived(() => {
		if (!todo.recurrence || !activeInstance) return null;

		const fromDate = new Date(activeInstance.scheduledDate);
		const next = getNextOccurrence(todo.recurrence, fromDate);

		return next;
	});

	function formatDate(date: Date): string {
		const month = date.getMonth() + 1;
		const day = date.getDate();
		const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
		return `${month}/${day}(${dayOfWeek})`;
	}

	async function handleSkip() {
		if (!activeInstance) return;

		submitting = true;

		try {
			await memosStore.skipTodoInstance(todo.id, activeInstance.id, skipReason.trim() || undefined);
			onClose();
		} catch (error) {
			console.error('Failed to skip todo instance:', error);
			alert('건너뛰기 실패');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onclick={(e) => e.target === e.currentTarget && onClose()}>
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
		<!-- Header -->
		<div class="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
				<SkipForward class="w-5 h-5" />
				⏭️ 건너뛰기 - {todo.title}
			</h2>
			<button
				onclick={onClose}
				class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<!-- Content -->
		<div class="p-6 space-y-4">
			<!-- 현재 일정 -->
			{#if activeInstance}
				<div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
					<p class="text-sm text-blue-900 dark:text-blue-100">
						현재 일정: <strong>{activeInstance.scheduledDate}</strong>
					</p>
				</div>
			{/if}

			<!-- 다음 일정 안내 -->
			{#if nextSchedule()}
				<div class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
					<p class="text-sm text-green-900 dark:text-green-100">
						다음 할일: <strong>{formatDate(nextSchedule())}</strong>에 자동 생성됩니다.
					</p>
				</div>
			{:else}
				<div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
					<p class="text-sm text-yellow-900 dark:text-yellow-100">
						⚠️ 반복 종료 - 다음 일정이 없습니다.
					</p>
				</div>
			{/if}

			<!-- 사유 입력 -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					사유 (선택)
				</label>
				<textarea
					bind:value={skipReason}
					placeholder="예: 출장, 휴가, 기타 사유..."
					rows="3"
					class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
				></textarea>
			</div>
		</div>

		<!-- Actions -->
		<div class="px-6 pb-6 flex gap-3">
			<button
				type="button"
				onclick={onClose}
				disabled={submitting}
				class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				취소
			</button>
			<button
				type="button"
				onclick={handleSkip}
				disabled={submitting}
				class="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
			>
				{submitting ? '처리 중...' : '⏭️ 건너뛰기'}
			</button>
		</div>
	</div>
</div>
