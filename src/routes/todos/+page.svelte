<script lang="ts">
	import { memosStore } from '$lib/stores/memos.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import TodoForm from '$lib/components/todo/TodoForm.svelte';
	import PostponeSheet from '$lib/components/todo/PostponeSheet.svelte';
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

	let showTodoForm = $state(false);
	let showPostponeSheet = $state(false);
	let selectedFilter = $state<'today' | 'week' | 'all' | 'completed'>('today');
	let editingTodo = $state<Memo | undefined>(undefined);
	let postponingTodo = $state<Memo | undefined>(undefined);

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
							<div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4">
								<div class="flex items-start gap-3">
									<input
										type="checkbox"
										checked={todo.todoStatus === 'completed'}
										onchange={() => toggleComplete(todo)}
										class="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<div class="flex-1 min-w-0">
										<div class="flex items-start justify-between gap-2">
											<button
												onclick={() => openTodoForm(todo)}
												class="text-left flex-1 min-w-0"
											>
												<h3 class="font-medium text-gray-900 dark:text-white {todo.todoStatus === 'completed' ? 'line-through opacity-60' : ''}">
													{todo.title}
												</h3>
												{#if todo.content}
													<p class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
														{todo.content}
													</p>
												{/if}
											</button>
											{#if todo.todoPriority}
												<span class="px-2 py-1 text-xs font-medium rounded {getPriorityColor(todo.todoPriority)}">
													{getPriorityLabel(todo.todoPriority)}
												</span>
											{/if}
										</div>
										<div class="flex items-center gap-3 mt-2 text-sm text-red-600 dark:text-red-400">
											<span class="flex items-center gap-1">
												<Calendar class="w-4 h-4" />
												{formatDueDate(todo)}
											</span>
											<span class="font-medium">
												❌ {getOverdueDays(todo)}일 초과
											</span>
										</div>
										{#if todo.tags.length > 0}
											<div class="flex flex-wrap gap-1 mt-2">
												{#each todo.tags as tag}
													<span class="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
														#{tag}
													</span>
												{/each}
											</div>
										{/if}
									</div>
								</div>
							</div>
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
							<div class="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
								<div class="flex items-start gap-3">
									<input
										type="checkbox"
										checked={todo.todoStatus === 'completed'}
										onchange={() => toggleComplete(todo)}
										class="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<div class="flex-1 min-w-0">
										<div class="flex items-start justify-between gap-2">
											<button
												onclick={() => openTodoForm(todo)}
												class="text-left flex-1 min-w-0"
											>
												<h3 class="font-medium text-gray-900 dark:text-white {todo.todoStatus === 'completed' ? 'line-through opacity-60' : ''}">
													{todo.title}
												</h3>
												{#if todo.content}
													<p class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
														{todo.content}
													</p>
												{/if}
											</button>
											{#if todo.todoPriority && todo.todoStatus !== 'completed'}
												<span class="px-2 py-1 text-xs font-medium rounded {getPriorityColor(todo.todoPriority)}">
													{getPriorityLabel(todo.todoPriority)}
												</span>
											{/if}
										</div>
										<div class="flex items-center gap-3 mt-2 text-sm text-gray-600 dark:text-gray-400">
											{#if dateStr !== 'no-due-date'}
												<span class="flex items-center gap-1">
													<Clock class="w-4 h-4" />
													{todo.dueTime && todo.dueTime !== '23:59' ? todo.dueTime : '하루 종일'}
												</span>
											{/if}
											{#if todo.todoStatus === 'completed' && todo.completedAt}
												<span class="text-green-600 dark:text-green-400">
													✅ {new Date(todo.completedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
												</span>
											{/if}
										</div>
										{#if todo.tags.length > 0}
											<div class="flex flex-wrap gap-1 mt-2">
												{#each todo.tags as tag}
													<span class="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
														#{tag}
													</span>
												{/each}
											</div>
										{/if}
									</div>
								</div>
							</div>
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
