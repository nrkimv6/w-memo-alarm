<script lang="ts">
	import { memosStore } from '$lib/stores/memos.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import TodoForm from '$lib/components/todo/TodoForm.svelte';
	import TodoCard from '$lib/components/todo/TodoCard.svelte';
	import PostponeSheet from '$lib/components/todo/PostponeSheet.svelte';
	import AlertModal from '$lib/components/todo/AlertModal.svelte';
	import UndoToast from '$lib/components/todo/UndoToast.svelte';
	import {
		filterTodos,
		sortTodos,
		groupTodosByDate,
		isOverdue,
		getTodayProgress,
		formatDueDate,
		getOverdueDays,
		getPriorityColor,
		getPriorityLabel
	} from '$lib/utils/todo';
	import type { Memo } from '$lib/types/memo';
	import { Plus, Search, Settings, CheckSquare, Calendar, Clock, AlertCircle } from 'lucide-svelte';
	import { onMount, onDestroy } from 'svelte';
	import { initTodoAlertManager, cleanupTodoAlertManager } from '$lib/utils/todoAlertManager.svelte';

	let showTodoForm = $state(false);
	let showPostponeSheet = $state(false);
	let showAlertModal = $state(false);
	let showUndoToast = $state(false);
	let selectedFilter = $state<'today' | 'week' | 'all' | 'completed'>('today');
	let editingTodo = $state<Memo | undefined>(undefined);
	let postponingTodo = $state<Memo | undefined>(undefined);
	let alertingTodo = $state<Memo | undefined>(undefined);
	let lastCompletedTodo = $state<Memo | undefined>(undefined);

	const memos = $derived(memosStore.memos);
	const todos = $derived(memos.filter(m => m.memoType === 'todo'));
	const filteredTodos = $derived(filterTodos(todos, selectedFilter));
	const sortedTodos = $derived(sortTodos(filteredTodos));
	const groupedTodos = $derived(groupTodosByDate(sortedTodos));
	const todayProgress = $derived(getTodayProgress(todos));
	const showProgress = $derived(settingsStore.settings.todoDefaults.showProgress);

	function openTodoForm(todo?: Memo) {
		editingTodo = todo;
		showTodoForm = true;
	}

	function closeTodoForm() {
		showTodoForm = false;
		editingTodo = undefined;
	}

	function openPostponeSheet(todo: Memo) {
		postponingTodo = todo;
		showPostponeSheet = true;
	}

	function closePostponeSheet() {
		showPostponeSheet = false;
		postponingTodo = undefined;
	}

	async function toggleComplete(todo: Memo) {
		const newStatus = todo.todoStatus === 'completed' ? 'pending' : 'completed';
		await memosStore.updateMemo(todo.id, {
			todoStatus: newStatus,
			completedAt: newStatus === 'completed' ? Date.now() : undefined
		});

		// 완료 시 undo 토스트 표시 (Phase 2)
		if (newStatus === 'completed') {
			lastCompletedTodo = todo;
			showUndoToast = true;
		}
	}

	async function handleUndo() {
		if (!lastCompletedTodo) return;
		await memosStore.updateMemo(lastCompletedTodo.id, {
			todoStatus: 'pending',
			completedAt: undefined
		});
		lastCompletedTodo = undefined;
	}

	function dismissUndoToast() {
		showUndoToast = false;
		lastCompletedTodo = undefined;
	}

	async function handleSkip(todo: Memo) {
		if (!confirm(`"${todo.title}" 할일을 건너뛰시겠습니까?`)) return;

		await memosStore.updateMemo(todo.id, {
			todoStatus: 'skipped'
		});
	}

	function formatSectionDate(dateStr: string): string {
		if (dateStr === 'no-due-date') return '기한 없음';

		const date = new Date(dateStr);
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);

		if (date.toDateString() === today.toDateString()) {
			return `오늘 ${date.getMonth() + 1}/${date.getDate()} (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`;
		} else if (date.toDateString() === tomorrow.toDateString()) {
			return `내일 ${date.getMonth() + 1}/${date.getDate()} (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`;
		}

		return `${date.getMonth() + 1}/${date.getDate()} (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`;
	}

	function handleAlert(todo: Memo) {
		alertingTodo = todo;
		showAlertModal = true;
	}

	function closeAlertModal() {
		showAlertModal = false;
		alertingTodo = undefined;
	}

	function handleAlertPostpone(todo: Memo) {
		closeAlertModal();
		openPostponeSheet(todo);
	}

	onMount(() => {
		// 포그라운드 알람 감지 시작
		initTodoAlertManager(() => memosStore.memos, handleAlert);
	});

	onDestroy(() => {
		// 정리
		cleanupTodoAlertManager();
	});
</script>

<svelte:head>
	<title>할일 - Memo Alarm</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
	<!-- Header -->
	<header class="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
		<div class="max-w-4xl mx-auto px-4 py-4">
			<div class="flex items-center justify-between">
				<h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
					<CheckSquare class="w-6 h-6" />
					할일
				</h1>
				<div class="flex items-center gap-2">
					<button class="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
						<Search class="w-5 h-5" />
					</button>
					<a href="/settings" class="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
						<Settings class="w-5 h-5" />
					</a>
					<button
						onclick={() => openTodoForm()}
						class="p-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
					>
						<Plus class="w-5 h-5" />
					</button>
				</div>
			</div>

			<!-- Filter Tabs -->
			<div class="flex gap-2 mt-4 overflow-x-auto">
				{#each [
					{ value: 'today', label: '오늘' },
					{ value: 'week', label: '이번주' },
					{ value: 'all', label: '전체' },
					{ value: 'completed', label: '완료됨' }
				] as filter}
					<button
						onclick={() => selectedFilter = filter.value as any}
						class="px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors {
							selectedFilter === filter.value
								? 'bg-blue-600 text-white'
								: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
						}"
					>
						{filter.label}
					</button>
				{/each}
			</div>
		</div>
	</header>

	<!-- Content -->
	<main class="max-w-4xl mx-auto px-4 py-6">
		{#if sortedTodos.length === 0}
			<div class="text-center py-12">
				<CheckSquare class="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
				<p class="text-gray-600 dark:text-gray-400">
					{selectedFilter === 'completed' ? '완료된 할일이 없습니다' : '할일이 없습니다'}
				</p>
				{#if selectedFilter !== 'completed'}
					<button
						onclick={() => openTodoForm()}
						class="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
					>
						새 할일 만들기
					</button>
				{/if}
			</div>
		{:else}
			<!-- Overdue Section -->
			{@const overdueTodos = sortedTodos.filter(isOverdue)}
			{#if overdueTodos.length > 0 && selectedFilter !== 'completed'}
				<section class="mb-6">
					<h2 class="text-lg font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
						<AlertCircle class="w-5 h-5" />
						⚠️ 기한 지남 ({overdueTodos.length})
					</h2>
					<div class="space-y-2">
						{#each overdueTodos as todo}
							<TodoCard
								{todo}
								onEdit={openTodoForm}
								onPostpone={openPostponeSheet}
								onSkip={handleSkip}
							/>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Grouped Todos -->
			{@const nonOverdueTodos = Array.from(groupedTodos.entries()).filter(([date, todos]) =>
				!todos.every(isOverdue) || selectedFilter === 'completed'
			)}
			{#each nonOverdueTodos as [dateStr, dateTodos]}
				<section class="mb-6">
					<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
						<Calendar class="w-5 h-5" />
						{formatSectionDate(dateStr)}
					</h2>
					<div class="space-y-2">
						{#each dateTodos.filter(t => !isOverdue(t) || selectedFilter === 'completed') as todo}
							<TodoCard
								{todo}
								onEdit={openTodoForm}
								onPostpone={openPostponeSheet}
								onSkip={handleSkip}
							/>
						{/each}
					</div>
				</section>
			{/each}
		{/if}

		<!-- Progress Bar -->
		{#if showProgress && selectedFilter === 'today'}
			<div class="mt-8 p-4 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
						📊 오늘 진행률
					</span>
					<span class="text-sm text-gray-600 dark:text-gray-400">
						{todayProgress.completed}/{todayProgress.total} ({todayProgress.percentage}%)
					</span>
				</div>
				<div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
					<div
						class="bg-blue-600 h-2 rounded-full transition-all duration-300"
						style="width: {todayProgress.percentage}%"
					></div>
				</div>
			</div>
		{/if}
	</main>
</div>

<!-- Todo Form Modal -->
{#if showTodoForm}
	<TodoForm memo={editingTodo} onClose={closeTodoForm} />
{/if}

<!-- Postpone Sheet -->
{#if showPostponeSheet && postponingTodo}
	<PostponeSheet todo={postponingTodo} onClose={closePostponeSheet} />
{/if}

<!-- Alert Modal -->
{#if showAlertModal && alertingTodo}
	<AlertModal todo={alertingTodo} onClose={closeAlertModal} onPostpone={handleAlertPostpone} />
{/if}

<!-- Undo Toast -->
{#if showUndoToast && lastCompletedTodo}
	<UndoToast
		message={`"${lastCompletedTodo.title}" 완료`}
		onUndo={handleUndo}
		onDismiss={dismissUndoToast}
	/>
{/if}
