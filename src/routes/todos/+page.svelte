<script lang="ts">
	import { memosStore } from "$lib/stores/memos.svelte";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import { foldersStore } from "$lib/stores/folders.svelte";
	import TodoForm from "$lib/components/todo/TodoForm.svelte";
	import TodoCard from "$lib/components/todo/TodoCard.svelte";
	import PostponeSheet from "$lib/components/todo/PostponeSheet.svelte";
	import AlertModal from "$lib/components/todo/AlertModal.svelte";
	import UndoToast from "$lib/components/todo/UndoToast.svelte";
	import SkipDialog from "$lib/components/todo/SkipDialog.svelte";
	import TodoStats from "$lib/components/todo/TodoStats.svelte";
	import Button from "$lib/components/ui/Button.svelte";
	import {
		filterTodos,
		sortTodos,
		groupTodosByDate,
		isOverdue,
		formatDueDate,
		getOverdueDays,
		getPriorityColor,
		getPriorityLabel,
	} from "$lib/utils/todo";
	import { getTodayProgress, getWeekProgress } from "$lib/utils/todoProgress";
	import type { Memo } from "$lib/types/memo";
	import {
		Plus,
		Search,
		Settings,
		CheckSquare,
		Calendar,
		Clock,
		AlertCircle,
		BarChart3,
		ChevronDown,
		ChevronUp,
		CheckSquare2,
		X,
		Trash2,
	} from "lucide-svelte";
	import { onMount, onDestroy } from "svelte";
	import {
		initTodoAlertManager,
		cleanupTodoAlertManager,
	} from "$lib/utils/todoAlertManager.svelte";

	let showTodoForm = $state(false);
	let showPostponeSheet = $state(false);
	let showSkipDialog = $state(false);
	let showAlertModal = $state(false);
	let showUndoToast = $state(false);
	let showStats = $state(false);
	let selectedFilter = $state<"today" | "week" | "all" | "completed">(
		"today",
	);
	let selectedTag = $state<string | undefined>(undefined);
	let selectedFolder = $state<string | undefined>(undefined);
	let editingTodo = $state<Memo | undefined>(undefined);
	let postponingTodo = $state<Memo | undefined>(undefined);
	let skippingTodo = $state<Memo | undefined>(undefined);
	let alertingTodo = $state<Memo | undefined>(undefined);
	let lastCompletedTodo = $state<Memo | undefined>(undefined);
	// Phase 4 Section 7: Batch actions
	let isMultiSelectMode = $state(false);
	let selectedTodoIds = $state<Set<string>>(new Set());

	const memos = $derived(memosStore.memos);
	const todos = $derived(memos.filter((m) => m.memoType === "todo"));
	const filteredTodos = $derived.by(() => {
		let result = filterTodos(todos, selectedFilter);

		// Phase 4 Section 4: Tag filtering
		const tag = selectedTag;
		if (tag) {
			result = result.filter((t) => t.tags.includes(tag));
		}

		// Phase 4 Section 4: Folder filtering
		const folder = selectedFolder;
		if (folder) {
			result = result.filter((t) => t.folderId === folder);
		}

		return result;
	});
	const sortedTodos = $derived(sortTodos(filteredTodos));
	const groupedTodos = $derived(groupTodosByDate(sortedTodos));
	const todayProgress = $derived(getTodayProgress(todos));
	const weekProgress = $derived(getWeekProgress(todos));
	const showProgress = $derived(
		settingsStore.settings.todoDefaults.showProgress,
	);

	// Get all unique tags from todos
	const availableTags = $derived.by(() => {
		const tags = new Set<string>();
		todos.forEach((todo) => {
			todo.tags.forEach((tag) => tags.add(tag));
		});
		return Array.from(tags).sort();
	});

	// Get all folders that have todos
	const availableFolders = $derived.by(() => {
		const folderIds = new Set<string>();
		todos.forEach((todo) => {
			if (todo.folderId) folderIds.add(todo.folderId);
		});
		return folderIds;
	});

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

	function openSkipDialog(todo: Memo) {
		skippingTodo = todo;
		showSkipDialog = true;
	}

	function closeSkipDialog() {
		showSkipDialog = false;
		skippingTodo = undefined;
	}

	async function toggleComplete(todo: Memo) {
		// 반복 할일인 경우 (Phase 3)
		if (todo.recurrence && todo.todoInstances) {
			const activeInstance = todo.todoInstances.find(
				(i) => i.status === "pending",
			);
			if (activeInstance) {
				// 현재 인스턴스 완료 + 다음 인스턴스 생성
				await memosStore.completeTodoInstance(
					todo.id,
					activeInstance.id,
				);
				lastCompletedTodo = todo;
				showUndoToast = true;
				return;
			}
		}

		// 단발성 할일 또는 반복 종료된 할일
		const newStatus =
			todo.todoStatus === "completed" ? "pending" : "completed";
		await memosStore.updateMemo(todo.id, {
			todoStatus: newStatus,
			completedAt: newStatus === "completed" ? Date.now() : undefined,
		});

		// 완료 시 undo 토스트 표시 (Phase 2)
		if (newStatus === "completed") {
			lastCompletedTodo = todo;
			showUndoToast = true;
		}
	}

	async function handleUndo() {
		if (!lastCompletedTodo) return;
		await memosStore.updateMemo(lastCompletedTodo.id, {
			todoStatus: "pending",
			completedAt: undefined,
		});
		lastCompletedTodo = undefined;
	}

	function dismissUndoToast() {
		showUndoToast = false;
		lastCompletedTodo = undefined;
	}

	function formatSectionDate(dateStr: string): string {
		if (dateStr === "no-due-date") return "기한 없음";

		const date = new Date(dateStr);
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);

		if (date.toDateString() === today.toDateString()) {
			return `오늘 ${date.getMonth() + 1}/${date.getDate()} (${["일", "월", "화", "수", "목", "금", "토"][date.getDay()]})`;
		} else if (date.toDateString() === tomorrow.toDateString()) {
			return `내일 ${date.getMonth() + 1}/${date.getDate()} (${["일", "월", "화", "수", "목", "금", "토"][date.getDay()]})`;
		}

		return `${date.getMonth() + 1}/${date.getDate()} (${["일", "월", "화", "수", "목", "금", "토"][date.getDay()]})`;
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

	// Phase 4 Section 7: Batch Actions
	function toggleMultiSelectMode() {
		isMultiSelectMode = !isMultiSelectMode;
		if (!isMultiSelectMode) {
			selectedTodoIds = new Set();
		}
	}

	function toggleTodoSelection(todoId: string) {
		const newSelection = new Set(selectedTodoIds);
		if (newSelection.has(todoId)) {
			newSelection.delete(todoId);
		} else {
			newSelection.add(todoId);
		}
		selectedTodoIds = newSelection;
	}

	function selectAllOverdue() {
		const overdueTodos = sortedTodos.filter(isOverdue);
		selectedTodoIds = new Set(overdueTodos.map((t) => t.id));
		isMultiSelectMode = true;
	}

	async function batchComplete() {
		if (selectedTodoIds.size === 0) return;

		for (const todoId of selectedTodoIds) {
			const todo = memosStore.getById(todoId);
			if (todo && todo.todoStatus !== "completed") {
				await memosStore.updateMemo(todoId, {
					todoStatus: "completed",
					completedAt: Date.now(),
				});
			}
		}

		selectedTodoIds = new Set();
		isMultiSelectMode = false;
	}

	async function batchDelete() {
		if (selectedTodoIds.size === 0) return;

		const confirmed = confirm(
			`선택한 ${selectedTodoIds.size}개의 할일을 삭제하시겠습니까?`,
		);
		if (!confirmed) return;

		for (const todoId of selectedTodoIds) {
			await memosStore.remove(todoId);
		}

		selectedTodoIds = new Set();
		isMultiSelectMode = false;
	}

	async function postponeAllOverdueToTomorrow() {
		const overdueTodos = sortedTodos.filter(isOverdue);
		if (overdueTodos.length === 0) return;

		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = tomorrow.toISOString().split("T")[0];

		for (const todo of overdueTodos) {
			await memosStore.updateMemo(todo.id, {
				dueDate: tomorrowStr,
			});
		}
	}

	async function completeAllOverdue() {
		const overdueTodos = sortedTodos.filter(isOverdue);
		if (overdueTodos.length === 0) return;

		const confirmed = confirm(
			`기한 지난 ${overdueTodos.length}개의 할일을 모두 완료하시겠습니까?`,
		);
		if (!confirmed) return;

		for (const todo of overdueTodos) {
			await memosStore.updateMemo(todo.id, {
				todoStatus: "completed",
				completedAt: Date.now(),
			});
		}
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

<div>
	<!-- Header -->
	<header
		class="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50"
	>
		<div class="max-w-6xl mx-auto px-4 py-4 space-y-3">
			<div class="flex items-center justify-between gap-4">
				<h1
					class="text-xl font-bold tracking-tight text-foreground shrink-0 flex items-center gap-2"
				>
					<CheckSquare class="w-5 h-5 text-primary" />
					할일
				</h1>
				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						class="text-muted-foreground"
						title="검색"
					>
						<Search class="w-4 h-4" />
					</Button>
					<Button
						variant={showStats ? "secondary" : "ghost"}
						size="icon"
						onclick={() => (showStats = !showStats)}
						class={showStats
							? "text-secondary"
							: "text-muted-foreground"}
						title="통계"
					>
						<BarChart3 class="w-4 h-4" />
					</Button>
					<Button
						variant={isMultiSelectMode ? "secondary" : "ghost"}
						size="icon"
						onclick={toggleMultiSelectMode}
						class={isMultiSelectMode
							? "text-secondary"
							: "text-muted-foreground"}
						title="다중 선택"
					>
						<CheckSquare2 class="w-4 h-4" />
					</Button>
					<a
						href="/settings"
						class="inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-muted hover:text-foreground h-9 w-9 text-muted-foreground"
					>
						<Settings class="w-4 h-4" />
					</a>
					<Button
						variant="default"
						onclick={() => openTodoForm()}
						class="shrink-0"
					>
						<Plus class="w-4 h-4" />
						<span class="hidden sm:inline ml-2">할일 추가</span>
					</Button>
				</div>
			</div>

			<!-- Filter Tabs -->
			<div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
				{#each [{ value: "today", label: "오늘" }, { value: "week", label: "이번주" }, { value: "all", label: "전체" }, { value: "completed", label: "완료됨" }] as filter}
					<button
						onclick={() => (selectedFilter = filter.value as any)}
						class="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors {selectedFilter ===
						filter.value
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
					>
						{filter.label}
					</button>
				{/each}
			</div>

			<!-- Tag & Folder Filters (Phase 4 Section 4) -->
			{#if availableTags.length > 0 || availableFolders.size > 0}
				<div class="mt-4 space-y-2">
					<!-- Tag Filters -->
					{#if availableTags.length > 0}
						<div class="flex items-center gap-2 flex-wrap">
							<span
								class="text-sm font-medium text-gray-700 dark:text-gray-300"
								>태그:</span
							>
							<button
								onclick={() => (selectedTag = undefined)}
								class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors {selectedTag ===
								undefined
									? 'bg-secondary/20 text-secondary border border-secondary/30'
									: 'bg-muted/50 text-muted-foreground hover:bg-muted'}"
							>
								전체
							</button>
							{#each availableTags as tag}
								<button
									onclick={() =>
										(selectedTag =
											selectedTag === tag
												? undefined
												: tag)}
									class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors {selectedTag ===
									tag
										? 'bg-secondary/20 text-secondary border border-secondary/30'
										: 'bg-muted/50 text-muted-foreground hover:bg-muted'}"
								>
									#{tag}
								</button>
							{/each}
						</div>
					{/if}

					<!-- Folder Filters -->
					{#if availableFolders.size > 0}
						<div class="flex items-center gap-2 flex-wrap">
							<span
								class="text-sm font-medium text-gray-700 dark:text-gray-300"
								>폴더:</span
							>
							<button
								onclick={() => (selectedFolder = undefined)}
								class="px-3 py-1 rounded-full text-sm transition-colors {selectedFolder ===
								undefined
									? 'bg-purple-600 text-white'
									: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}"
							>
								전체
							</button>
							{#each Array.from(availableFolders) as folderId}
								{@const folder = foldersStore.getById(folderId)}
								{#if folder}
									<button
										onclick={() =>
											(selectedFolder =
												selectedFolder === folderId
													? undefined
													: folderId)}
										class="px-3 py-1 rounded-full text-sm transition-colors {selectedFolder ===
										folderId
											? 'bg-purple-600 text-white'
											: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}"
										style="background-color: {selectedFolder ===
										folderId
											? folder.color
											: ''}"
									>
										{folder.icon
											? folder.icon + " "
											: ""}{folder.name}
									</button>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Progress Bar -->
			{#if showProgress && (selectedFilter === "today" || selectedFilter === "week" || selectedFilter === "all")}
				<div
					class="mt-3 p-3 bg-muted/30 rounded-lg border border-border/50"
				>
					<div class="flex items-center justify-between text-xs mb-2">
						<span class="font-medium text-foreground">
							📊 오늘: {todayProgress.completed}/{todayProgress.total}
							({todayProgress.percentage}%)
						</span>
						<span class="text-muted-foreground">
							| 이번 주: {weekProgress.completed}/{weekProgress.total}
							({weekProgress.percentage}%)
						</span>
					</div>
					<div class="flex gap-2">
						<!-- Today Progress Bar -->
						<div class="flex-1">
							<div
								class="w-full bg-muted rounded-full h-1.5 overflow-hidden"
							>
								<div
									class="h-full bg-primary transition-all duration-300"
									style="width: {todayProgress.percentage}%"
								></div>
							</div>
						</div>
						<!-- Week Progress Bar -->
						<div class="flex-1">
							<div
								class="w-full bg-muted rounded-full h-1.5 overflow-hidden"
							>
								<div
									class="h-full bg-secondary transition-all duration-300"
									style="width: {weekProgress.percentage}%"
								></div>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</header>

	<!-- Statistics Section (Phase 4 Section 6) -->
	{#if showStats}
		<div
			class="max-w-6xl mx-auto px-4 py-4 bg-background border-b border-border/50 animate-fade-in"
		>
			<TodoStats {todos} />
		</div>
	{/if}

	<!-- Batch Action Bar (Phase 4 Section 7) -->
	{#if isMultiSelectMode && selectedTodoIds.size > 0}
		<div
			class="sticky top-40 z-10 bg-secondary/10 border-y border-secondary/20 animate-fade-in"
		>
			<div
				class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between"
			>
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium text-secondary">
						{selectedTodoIds.size}개 선택됨
					</span>
				</div>
				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onclick={batchComplete}
						class="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
					>
						<CheckSquare class="w-4 h-4 mr-1" />
						완료
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onclick={batchDelete}
						class="text-destructive hover:bg-destructive/10"
					>
						<Trash2 class="w-4 h-4 mr-1" />
						삭제
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onclick={toggleMultiSelectMode}
					>
						<X class="w-4 h-4 mr-1" />
						취소
					</Button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Content -->
	<main class="max-w-6xl mx-auto px-4 py-6">
		{#if sortedTodos.length === 0}
			<div
				class="flex flex-col items-center justify-center py-12 text-center"
			>
				<div
					class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"
				>
					<CheckSquare class="w-8 h-8 text-muted-foreground" />
				</div>
				<p class="text-muted-foreground">
					{selectedFilter === "completed"
						? "완료된 할일이 없습니다"
						: "할일이 없습니다"}
				</p>
				{#if selectedFilter !== "completed"}
					<Button
						variant="default"
						onclick={() => openTodoForm()}
						class="mt-4"
					>
						새 할일 만들기
					</Button>
				{/if}
			</div>
		{:else}
			<!-- Overdue Section -->
			{@const overdueTodos = sortedTodos.filter(isOverdue)}
			{#if overdueTodos.length > 0 && selectedFilter !== "completed"}
				<section class="mb-6">
					<div class="flex items-center justify-between mb-3">
						<h2
							class="text-sm font-semibold text-destructive flex items-center gap-2"
						>
							<AlertCircle class="w-4 h-4" />
							기한 지남 ({overdueTodos.length})
						</h2>
						<!-- Quick Actions (Phase 4 Section 7-3) -->
						<div class="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								class="h-7 text-xs"
								onclick={selectAllOverdue}
							>
								모두 선택
							</Button>
							<div class="h-3 w-px bg-border"></div>
							<Button
								variant="ghost"
								size="sm"
								class="h-7 text-xs text-orange-600 hover:text-orange-700"
								onclick={postponeAllOverdueToTomorrow}
							>
								내일로 미루기
							</Button>
						</div>
					</div>
					<div class="space-y-2">
						{#each overdueTodos as todo}
							<TodoCard
								{todo}
								onEdit={openTodoForm}
								onPostpone={openPostponeSheet}
								onSkip={openSkipDialog}
								{isMultiSelectMode}
								isSelected={selectedTodoIds.has(todo.id)}
								onToggleSelection={toggleTodoSelection}
							/>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Grouped Todos -->
			{@const nonOverdueTodos = Array.from(groupedTodos.entries()).filter(
				([date, todos]) =>
					!todos.every(isOverdue) || selectedFilter === "completed",
			)}
			{#each nonOverdueTodos as [dateStr, dateTodos]}
				<section class="mb-6">
					<h2
						class="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2 sticky top-[8.5rem] z-10 bg-background/95 backdrop-blur-sm py-2"
					>
						<Calendar class="w-4 h-4" />
						{formatSectionDate(dateStr)}
					</h2>
					<div class="space-y-2">
						{#each dateTodos.filter((t) => !isOverdue(t) || selectedFilter === "completed") as todo}
							<TodoCard
								{todo}
								onEdit={openTodoForm}
								onPostpone={openPostponeSheet}
								onSkip={openSkipDialog}
								{isMultiSelectMode}
								isSelected={selectedTodoIds.has(todo.id)}
								onToggleSelection={toggleTodoSelection}
							/>
						{/each}
					</div>
				</section>
			{/each}
		{/if}

		<!-- Progress Bar -->
		{#if showProgress && selectedFilter === "today"}
			<div
				class="mt-8 p-4 bg-muted/30 border border-border/50 rounded-xl"
			>
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm font-medium text-foreground">
						📊 오늘 진행률
					</span>
					<span class="text-sm text-muted-foreground">
						{todayProgress.completed}/{todayProgress.total} ({todayProgress.percentage}%)
					</span>
				</div>
				<div class="w-full bg-muted rounded-full h-2">
					<div
						class="bg-primary h-2 rounded-full transition-all duration-300"
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

<!-- Skip Dialog -->
{#if showSkipDialog && skippingTodo}
	<SkipDialog todo={skippingTodo} onClose={closeSkipDialog} />
{/if}

<!-- Alert Modal -->
{#if showAlertModal && alertingTodo}
	<AlertModal
		todo={alertingTodo}
		onClose={closeAlertModal}
		onPostpone={handleAlertPostpone}
	/>
{/if}

<!-- Undo Toast -->
{#if showUndoToast && lastCompletedTodo}
	<UndoToast
		message={`"${lastCompletedTodo.title}" 완료`}
		onUndo={handleUndo}
		onDismiss={dismissUndoToast}
	/>
{/if}
