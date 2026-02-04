<script lang="ts">
	import { Calendar, Clock, AlertCircle, MoreVertical, Calendar as CalendarIcon, Repeat, ChevronDown, ChevronUp } from 'lucide-svelte';
	import type { Memo } from '$lib/types/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { isOverdue, formatDueDate, getOverdueDays, getPriorityColor, getPriorityLabel } from '$lib/utils/todo';
	import { getRecurrenceDescription } from '$lib/utils/recurrence';
	import RecurringHistory from './RecurringHistory.svelte';

	interface Props {
		todo: Memo;
		compact?: boolean;
		onEdit?: (todo: Memo) => void;
		onPostpone?: (todo: Memo) => void;
		onSkip?: (todo: Memo) => void;
		// Phase 4 Section 7: Multi-select support
		isMultiSelectMode?: boolean;
		isSelected?: boolean;
		onToggleSelection?: (todoId: string) => void;
	}

	let { todo, compact = false, onEdit, onPostpone, onSkip, isMultiSelectMode = false, isSelected = false, onToggleSelection }: Props = $props();

	let showHistory = $state(false);

	const overdue = $derived(isOverdue(todo));
	const completed = $derived(todo.todoStatus === 'completed');
	const isRecurring = $derived(!!todo.recurrence);
	const recurrenceDesc = $derived(todo.recurrence ? getRecurrenceDescription(todo.recurrence) : '');
	const hasHistory = $derived(
		isRecurring && todo.todoInstances && todo.todoInstances.some(i => i.status !== 'pending')
	);

	async function handleToggleComplete() {
		// 반복 할일인 경우 (Phase 3)
		if (todo.recurrence && todo.todoInstances) {
			const activeInstance = todo.todoInstances.find(i => i.status === 'pending');
			if (activeInstance && !completed) {
				// 현재 인스턴스 완료 + 다음 인스턴스 생성
				await memosStore.completeTodoInstance(todo.id, activeInstance.id);
				return;
			}
		}

		// 단발성 할일 또는 반복 종료된 할일
		const newStatus = completed ? 'pending' : 'completed';
		await memosStore.updateMemo(todo.id, {
			todoStatus: newStatus,
			completedAt: newStatus === 'completed' ? Date.now() : undefined
		});
	}

	function handleEdit(e: MouseEvent) {
		e.stopPropagation();
		onEdit?.(todo);
	}

	function handlePostpone(e: MouseEvent) {
		e.stopPropagation();
		onPostpone?.(todo);
	}

	function handleSkip(e: MouseEvent) {
		e.stopPropagation();
		onSkip?.(todo);
	}
</script>

<div class="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow {
	overdue && !completed ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20' : ''
} {
	completed ? 'opacity-60' : ''
}">
	<div class="flex items-start gap-3">
		<!-- Checkbox -->
		{#if isMultiSelectMode}
			<!-- Multi-select checkbox (Phase 4 Section 7) -->
			<input
				type="checkbox"
				checked={isSelected}
				onchange={() => onToggleSelection?.(todo.id)}
				class="mt-1 w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
			/>
		{:else}
			<!-- Completion checkbox -->
			<input
				type="checkbox"
				checked={completed}
				onchange={handleToggleComplete}
				class="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
			/>
		{/if}

		<!-- Content -->
		<div class="flex-1 min-w-0">
			<div class="flex items-start justify-between gap-2">
				<!-- Title & Content -->
				<button
					onclick={handleEdit}
					class="text-left flex-1 min-w-0"
				>
					<h3 class="font-medium text-gray-900 dark:text-white {
						completed ? 'line-through' : ''
					} {
						overdue && !completed ? 'text-red-700 dark:text-red-300' : ''
					}">
						{todo.title}
					</h3>
					{#if todo.content && !compact}
						<p class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
							{todo.content}
						</p>
					{/if}
				</button>

				<!-- Priority Badge -->
				{#if todo.todoPriority && !completed}
					<span class="px-2 py-1 text-xs font-medium rounded {getPriorityColor(todo.todoPriority)}">
						{getPriorityLabel(todo.todoPriority)}
					</span>
				{/if}
			</div>

			<!-- Due Date & Status -->
			<div class="flex items-center gap-3 mt-2 text-sm flex-wrap">
				{#if todo.dueDate}
					<span class="flex items-center gap-1 {
						overdue && !completed ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'
					}">
						<Calendar class="w-4 h-4" />
						{formatDueDate(todo)}
					</span>
				{:else}
					<span class="text-gray-500 dark:text-gray-400 text-xs">
						기한 없음
					</span>
				{/if}

				{#if isRecurring}
					<span class="flex items-center gap-1 text-purple-600 dark:text-purple-400 text-xs font-medium">
						<Repeat class="w-3 h-3" />
						{recurrenceDesc}
					</span>
				{/if}

				{#if overdue && !completed}
					<span class="text-red-600 dark:text-red-400 font-medium text-xs">
						❌ {getOverdueDays(todo)}일 초과
					</span>
				{/if}

				{#if completed && todo.completedAt}
					<span class="text-green-600 dark:text-green-400 text-xs">
						✅ {new Date(todo.completedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
					</span>
				{/if}
			</div>

			<!-- Tags -->
			{#if todo.tags.length > 0 && !compact}
				<div class="flex flex-wrap gap-1 mt-2">
					{#each todo.tags as tag}
						<span class="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
							#{tag}
						</span>
					{/each}
				</div>
			{/if}

			<!-- Actions -->
			{#if !completed}
				<div class="flex gap-2 mt-3">
					{#if todo.dueDate}
						<button
							onclick={handlePostpone}
							class="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-md transition-colors"
						>
							📌 미루기
						</button>
					{/if}
					{#if isRecurring}
						<button
							onclick={handleSkip}
							class="px-3 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-md transition-colors"
						>
							⏭️ 건너뛰기
						</button>
					{/if}
					<button
						onclick={handleEdit}
						class="px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
					>
						✏️ 편집
					</button>
				</div>
			{/if}

			<!-- 반복 이력 토글 버튼 -->
			{#if hasHistory && !compact}
				<button
					onclick={() => showHistory = !showHistory}
					class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mt-2"
				>
					{#if showHistory}
						<ChevronUp class="w-4 h-4" />
						이력 숨기기
					{:else}
						<ChevronDown class="w-4 h-4" />
						이력 보기
					{/if}
				</button>
			{/if}

			<!-- 반복 이력 -->
			{#if showHistory && hasHistory && !compact}
				<RecurringHistory {todo} />
			{/if}
		</div>
	</div>
</div>
