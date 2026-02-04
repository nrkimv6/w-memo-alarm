<script lang="ts">
	import { Calendar, Repeat, ChevronDown, ChevronUp } from "lucide-svelte";
	import type { Memo } from "$lib/types/memo";
	import { memosStore } from "$lib/stores/memos.svelte";
	import {
		isOverdue,
		formatDueDate,
		getOverdueDays,
		getPriorityLabel,
	} from "$lib/utils/todo";
	import { getRecurrenceDescription } from "$lib/utils/recurrence";
	import RecurringHistory from "./RecurringHistory.svelte";

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

	let {
		todo,
		compact = false,
		onEdit,
		onPostpone,
		onSkip,
		isMultiSelectMode = false,
		isSelected = false,
		onToggleSelection,
	}: Props = $props();

	let showHistory = $state(false);

	const overdue = $derived(isOverdue(todo));
	const completed = $derived(todo.todoStatus === "completed");
	const isRecurring = $derived(!!todo.recurrence);
	const recurrenceDesc = $derived(
		todo.recurrence ? getRecurrenceDescription(todo.recurrence) : "",
	);
	const hasHistory = $derived(
		isRecurring &&
			todo.todoInstances &&
			todo.todoInstances.some((i) => i.status !== "pending"),
	);

	async function handleToggleComplete() {
		// 반복 할일인 경우 (Phase 3)
		if (todo.recurrence && todo.todoInstances) {
			const activeInstance = todo.todoInstances.find(
				(i) => i.status === "pending",
			);
			if (activeInstance && !completed) {
				// 현재 인스턴스 완료 + 다음 인스턴스 생성
				await memosStore.completeTodoInstance(
					todo.id,
					activeInstance.id,
				);
				return;
			}
		}

		// 단발성 할일 또는 반복 종료된 할일
		const newStatus = completed ? "pending" : "completed";
		await memosStore.updateMemo(todo.id, {
			todoStatus: newStatus,
			completedAt: newStatus === "completed" ? Date.now() : undefined,
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

	// Priority Style Mapping (Semantic)
	function getPriorityStyle(priority: string) {
		switch (priority) {
			case "high":
				return "bg-destructive/10 text-destructive border-destructive/20";
			case "medium":
				return "bg-orange-500/10 text-orange-600 border-orange-200 dark:text-orange-400";
			case "low":
				return "bg-blue-500/10 text-blue-600 border-blue-200 dark:text-blue-400";
			default:
				return "bg-muted text-muted-foreground border-border";
		}
	}
</script>

<div
	class="group relative bg-card rounded-xl border border-border/60 p-4 transition-all duration-200 hover:shadow-md hover:border-primary/20 {overdue &&
	!completed
		? 'bg-destructive/5 border-destructive/30'
		: ''} {completed ? 'opacity-50' : ''} {isSelected
		? 'ring-2 ring-primary border-primary bg-primary/5'
		: ''}"
>
	<div class="flex items-start gap-3">
		<!-- Checkbox -->
		{#if isMultiSelectMode}
			<!-- Multi-select checkbox -->
			<input
				type="checkbox"
				checked={isSelected}
				onchange={() => onToggleSelection?.(todo.id)}
				class="mt-1 w-5 h-5 rounded border-muted-foreground/30 text-primary focus:ring-primary cursor-pointer"
			/>
		{:else}
			<!-- Completion checkbox -->
			<input
				type="checkbox"
				checked={completed}
				onchange={handleToggleComplete}
				class="mt-1 w-5 h-5 rounded-md border-muted-foreground/30 text-primary focus:ring-primary cursor-pointer transition-colors hover:border-primary"
			/>
		{/if}

		<!-- Content -->
		<div class="flex-1 min-w-0">
			<div class="flex items-start justify-between gap-2">
				<!-- Title & Content -->
				<button
					onclick={handleEdit}
					class="text-left flex-1 min-w-0 group/title"
				>
					<h3
						class="font-medium text-foreground text-sm/relaxed {completed
							? 'line-through text-muted-foreground'
							: ''} {overdue && !completed
							? 'text-destructive'
							: ''} group-hover/title:text-primary transition-colors"
					>
						{todo.title}
					</h3>
					{#if todo.content && !compact}
						<p
							class="text-xs text-muted-foreground mt-1 line-clamp-2"
						>
							{todo.content}
						</p>
					{/if}
				</button>

				<!-- Priority Badge -->
				{#if todo.todoPriority && !completed && todo.todoPriority !== "none"}
					<span
						class="px-1.5 py-0.5 text-[10px] font-medium rounded-md border {getPriorityStyle(
							todo.todoPriority,
						)}"
					>
						{getPriorityLabel(todo.todoPriority)}
					</span>
				{/if}
			</div>

			<!-- Due Date & Status -->
			<div class="flex items-center gap-3 mt-2.5 text-xs flex-wrap">
				{#if todo.dueDate}
					<span
						class="flex items-center gap-1 {overdue && !completed
							? 'text-destructive font-medium'
							: 'text-muted-foreground'}"
					>
						<Calendar class="w-3.5 h-3.5" />
						{formatDueDate(todo)}
					</span>
				{/if}

				{#if isRecurring}
					<span
						class="flex items-center gap-1 text-secondary font-medium"
					>
						<Repeat class="w-3.5 h-3.5" />
						{recurrenceDesc}
					</span>
				{/if}

				{#if overdue && !completed}
					<span
						class="inline-flex items-center gap-1 text-destructive font-medium px-1.5 py-0.5 rounded bg-destructive/10"
					>
						<span>!</span>
						{getOverdueDays(todo)}일 지남
					</span>
				{/if}

				{#if completed && todo.completedAt}
					<span
						class="text-green-600 dark:text-green-500 font-medium"
					>
						{new Date(todo.completedAt).toLocaleDateString()} 완료
					</span>
				{/if}
			</div>

			<!-- Tags -->
			{#if todo.tags.length > 0 && !compact}
				<div class="flex flex-wrap gap-1.5 mt-2.5">
					{#each todo.tags as tag}
						<span
							class="px-2 py-0.5 bg-muted/50 text-muted-foreground rounded text-[11px] border border-border/50"
						>
							#{tag}
						</span>
					{/each}
				</div>
			{/if}

			<!-- Actions (Hover only on desktop, always visible if active on mobile? let's keep it clean) -->
			{#if !completed}
				<div
					class="flex items-center gap-2 mt-3 pt-2 border-t border-border/30 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
				>
					{#if todo.dueDate}
						<button
							onclick={handlePostpone}
							class="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
						>
							미루기
						</button>
					{/if}
					{#if isRecurring}
						<button
							onclick={handleSkip}
							class="px-2 py-1 text-xs font-medium text-orange-600/80 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
						>
							건너뛰기
						</button>
					{/if}
				</div>
			{/if}

			<!-- 반복 이력 토글 버튼 -->
			{#if hasHistory && !compact}
				<button
					onclick={() => (showHistory = !showHistory)}
					class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 w-full pt-1"
				>
					{#if showHistory}
						<ChevronUp class="w-3 h-3" />
						이력 숨기기
					{:else}
						<ChevronDown class="w-3 h-3" />
						이력 보기
					{/if}
				</button>
			{/if}

			<!-- 반복 이력 -->
			{#if showHistory && hasHistory && !compact}
				<div class="mt-2 text-xs">
					<RecurringHistory {todo} />
				</div>
			{/if}
		</div>
	</div>
</div>
