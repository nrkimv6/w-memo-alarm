<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Search, Pin, Star, Bell, Clock, ChevronRight, CheckSquare } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { filterTodos, isOverdue } from '$lib/utils/todo';
		import {
		MemoForm,
		MemoCard,
		MemoDetailModal,
		DeleteConfirmDialog,
		SearchBar,
		QuickMemoInput,
		ScheduledRemindersModal,
		ShareModal
	} from '$lib/components/memo';
	import SwipeGuideModal from '$lib/components/memo/SwipeGuideModal.svelte';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { filterStore } from '$lib/stores/filter.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { onboardingStore } from '$lib/stores/onboarding.svelte';
	import type { Memo } from '$lib/types/memo';

	const ONBOARDING_KEY = 'memo-alarm-onboarding-done';
	const MAX_ITEMS_PER_SECTION = 5;

	let showForm = $state(false);
	let showDeleteDialog = $state(false);
	let showDetailModal = $state(false);
	let showRemindersModal = $state(false);
	let showShareModal = $state(false);
	let showOnboarding = $state(false);
	let showSwipeGuide = $state(false);
	let showSearch = $state(false);
	let editingMemo = $state<Memo | null>(null);
	let deletingMemo = $state<Memo | null>(null);
	let viewingMemo = $state<Memo | null>(null);
	let sharingMemo = $state<Memo | null>(null);

	// FAB 스크롤 제어
	let lastScrollY = $state(0);
	let fabVisible = $state(true);

	// 대시보드용 메모 분류
	const pinnedMemos = $derived(
		memosStore.memos
			.filter((m) => m.isPinned && m.isActive && m.memoType !== 'todo')
			.slice(0, MAX_ITEMS_PER_SECTION)
	);

	const favoriteMemos = $derived(
		memosStore.memos
			.filter((m) => m.isFavorite && m.isActive && !m.isPinned && m.memoType !== 'todo')
			.slice(0, MAX_ITEMS_PER_SECTION)
	);

	const upcomingReminders = $derived.by(() => {
		const now = new Date();
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 2);
		tomorrow.setHours(0, 0, 0, 0);

		return memosStore.memos
			.filter((m) => {
				if (!m.isActive || !m.reminder?.enabled || !m.reminder?.datetime) return false;
				const reminderDate = new Date(m.reminder.datetime);
				return reminderDate >= now && reminderDate < tomorrow;
			})
			.sort((a, b) => {
				const dateA = new Date(a.reminder!.datetime!).getTime();
				const dateB = new Date(b.reminder!.datetime!).getTime();
				return dateA - dateB;
			})
			.slice(0, MAX_ITEMS_PER_SECTION);
	});

	const recentMemos = $derived(
		memosStore.memos
			.filter((m) => m.isActive && !m.isPinned && !m.isFavorite && m.memoType !== 'todo')
			.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
			.slice(0, MAX_ITEMS_PER_SECTION)
	);

	// 오늘의 할일 (오늘 기한 + overdue + 기한 없는 할일)
	const todayTodos = $derived(
		filterTodos(memosStore.memos, 'today')
			.sort((a, b) => {
				// overdue가 최상단
				const aOverdue = isOverdue(a);
				const bOverdue = isOverdue(b);
				if (aOverdue && !bOverdue) return -1;
				if (!aOverdue && bOverdue) return 1;
				// 나머지는 기한 순
				if (!a.dueDate) return 1;
				if (!b.dueDate) return -1;
				return a.dueDate.localeCompare(b.dueDate);
			})
			.slice(0, MAX_ITEMS_PER_SECTION)
	);

	const hasAnyMemos = $derived(memosStore.memos.length > 0);
	const filteredMemos = $derived(filterStore.getFilteredMemos());

	onMount(() => {
		// memosStore, filterStore, foldersStore 초기화는 +layout.svelte에서 수행됨

		// 알림 클릭으로 진입 시 ?memo= 파라미터 처리
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			const memoId = params.get('memo');
			if (memoId) {
				// URL에서 ?memo= 파라미터 제거 (뒤로가기 시 재진입 방지)
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);

				// memosStore가 초기화될 때까지 대기 후 메모 열기
				let retryCount = 0;
				const MAX_RETRY = 15; // 15회 * 200ms = 3초
				const tryOpenMemo = () => {
					const memo = memosStore.getById(memoId);
					if (memo) {
						viewingMemo = memo;
						showDetailModal = true;
					} else if (!memosStore.initialized && retryCount < MAX_RETRY) {
						retryCount++;
						setTimeout(tryOpenMemo, 200);
					} else if (memosStore.initialized && !memo) {
						// 초기화 완료했는데 메모가 없으면 삭제된 메모
						console.warn(`Memo ${memoId} not found`);
						// Toast 메시지 표시 (Toast 컴포넌트가 이미 import됨)
						const event = new CustomEvent('show-toast', {
							detail: { message: '해당 메모를 찾을 수 없습니다.', type: 'error' }
						});
						window.dispatchEvent(event);
					} else if (retryCount >= MAX_RETRY) {
						console.error(`Failed to open memo ${memoId} after ${MAX_RETRY} retries`);
						const event = new CustomEvent('show-toast', {
							detail: { message: '메모를 불러오는 데 실패했습니다.', type: 'error' }
						});
						window.dispatchEvent(event);
					}
				};
				tryOpenMemo();
			}
		}

		if (typeof window !== 'undefined' && !localStorage.getItem(ONBOARDING_KEY)) {
			showOnboarding = true;
		} else if (!onboardingStore.hasSeenSwipeGuide) {
			showSwipeGuide = true;
		}

		function handleKeydown(e: KeyboardEvent) {
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
				if (e.key === 'Escape') {
					target.blur();
					showSearch = false;
				}
				return;
			}

			if (e.key === 'n' || e.key === 'N') {
				e.preventDefault();
				handleCreateNew();
			}

			if (e.key === '/') {
				e.preventDefault();
				showSearch = true;
				setTimeout(() => {
					const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
					searchInput?.focus();
				}, 100);
			}

			if (e.key === 'Escape') {
				if (showSearch) {
					showSearch = false;
				} else if (showDetailModal) {
					handleDetailClose();
				} else if (showForm) {
					handleFormClose();
				} else if (showDeleteDialog) {
					deletingMemo = null;
					showDeleteDialog = false;
				}
			}
		}

		window.addEventListener('keydown', handleKeydown);

		// FAB 스크롤 제어 (throttle 적용)
		let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
		function handleScroll() {
			if (scrollTimeout) return;
			scrollTimeout = setTimeout(() => {
				const currentScrollY = window.scrollY;
				const scrollDelta = currentScrollY - lastScrollY;

				// 100px 이상 아래로 스크롤 시 숨기기, 위로 스크롤 시 표시
				if (scrollDelta > 50) {
					fabVisible = false;
				} else if (scrollDelta < -30) {
					fabVisible = true;
				}

				lastScrollY = currentScrollY;
				scrollTimeout = null;
			}, 100);
		}

		window.addEventListener('scroll', handleScroll);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('scroll', handleScroll);
		};
	});

	function handleCreateNew() {
		editingMemo = null;
		showForm = true;
	}

	function handleEdit(memo: Memo) {
		editingMemo = memo;
		showForm = true;
	}

	function handleDelete(memo: Memo) {
		deletingMemo = memo;
		showDeleteDialog = true;
	}

	function confirmDelete() {
		if (deletingMemo) {
			const title = deletingMemo.title || '메모';
			memosStore.remove(deletingMemo.id);
			toastStore.success(`"${title}" 삭제됨`);
			deletingMemo = null;
		}
	}

	function handleFormClose() {
		showForm = false;
		editingMemo = null;
	}

	function handleView(memo: Memo) {
		viewingMemo = memo;
		showDetailModal = true;
	}

	function handleDetailClose() {
		showDetailModal = false;
		viewingMemo = null;
	}

	function handleShare(memo: Memo) {
		sharingMemo = memo;
		showShareModal = true;
	}

	function handleShareClose() {
		showShareModal = false;
		sharingMemo = null;
	}

	function formatReminderTime(datetime: string): string {
		const date = new Date(datetime);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);
		const isTomorrow = date.toDateString() === tomorrow.toDateString();

		const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

		if (isToday) return `오늘 ${timeStr}`;
		if (isTomorrow) return `내일 ${timeStr}`;
		return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ` ${timeStr}`;
	}
</script>

<div>
	<!-- Header section -->
	<div class="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
		<div class="max-w-6xl mx-auto px-4 py-4 space-y-3">
			<!-- Title and buttons -->
			<div class="flex items-center justify-between gap-4">
				<h1 class="text-xl font-bold tracking-tight text-foreground shrink-0">홈</h1>
				<div class="flex items-center gap-2">
					<Button
						variant={showSearch ? "secondary" : "ghost"}
						size="icon"
						onclick={() => showSearch = !showSearch}
						title="검색 (/ 키)"
					>
						<Search class="w-4 h-4" />
					</Button>
					<Button onclick={handleCreateNew} class="shrink-0">
						<Plus class="w-4 h-4" />
						<span class="hidden sm:inline">새 메모</span>
					</Button>
				</div>
			</div>

			<!-- Quick memo input (검색 모드가 아닐 때만) -->
			{#if !showSearch}
				<QuickMemoInput />
			{/if}

			<!-- Search bar (토글) -->
			{#if showSearch}
				<div class="pt-2 border-t border-border/30">
					<SearchBar />
					{#if filteredMemos.length > 0 && filterStore.search}
						<div class="mt-3 space-y-2">
							<p class="text-sm text-muted-foreground">{filteredMemos.length}개의 검색 결과</p>
							{#each filteredMemos.slice(0, 5) as memo (memo.id)}
								<MemoCard
									{memo}
									compact
									ultraCompact
									onClick={handleView}
									onEdit={handleEdit}
									onDelete={handleDelete}
									onTogglePin={(id) => memosStore.togglePin(id)}
									onToggleFavorite={(id) => memosStore.toggleFavorite(id)}
									onToggleActive={(id) => memosStore.toggleActive(id)}
								/>
							{/each}
							{#if filteredMemos.length > 5}
								<a
									href="/memos"
									class="flex items-center justify-center gap-1 text-sm text-primary hover:underline py-2"
								>
									전체 {filteredMemos.length}개 보기
									<ChevronRight class="w-4 h-4" />
								</a>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Main content - Dashboard -->
	<main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
		{#if !hasAnyMemos}
			<!-- Empty state -->
			<div class="flex flex-col items-center justify-center py-8 text-center">
				<div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
					<Plus class="w-6 h-6 text-muted-foreground" />
				</div>
				<h2 class="text-lg font-semibold mb-1">메모가 없습니다</h2>
				<p class="text-sm text-muted-foreground mb-4">첫 번째 메모를 작성해보세요!</p>
				<Button onclick={handleCreateNew} size="sm">
					<Plus class="w-4 h-4" />
					새 메모 만들기
				</Button>
			</div>
		{:else}
			<!-- 고정된 메모 -->
			{#if pinnedMemos.length > 0}
				<section>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-base font-semibold flex items-center gap-2">
							<Pin class="w-4 h-4 text-primary" />
							고정된 메모
						</h2>
						<a href="/memos?filter=pinned" class="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
							더보기 <ChevronRight class="w-4 h-4" />
						</a>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{#each pinnedMemos as memo (memo.id)}
							<MemoCard
								{memo}
								compact
								onClick={handleView}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTogglePin={(id) => memosStore.togglePin(id)}
								onToggleFavorite={(id) => memosStore.toggleFavorite(id)}
								onToggleActive={(id) => memosStore.toggleActive(id)}
							/>
						{/each}
					</div>
				</section>
			{/if}

			<!-- 오늘의 할일 -->
			{#if todayTodos.length > 0}
				<section>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-base font-semibold flex items-center gap-2">
							<CheckSquare class="w-4 h-4 text-blue-600" />
							오늘의 할일
						</h2>
						<a href="/todos" class="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
							더보기 <ChevronRight class="w-4 h-4" />
						</a>
					</div>
					<div class="space-y-2">
						{#each todayTodos as todo (todo.id)}
							<div class="bg-card border rounded-lg p-3 {isOverdue(todo) ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20' : ''}">
								<div class="flex items-start gap-3">
									<input
										type="checkbox"
										checked={todo.todoStatus === 'completed'}
										onchange={() => memosStore.update(todo.id, {
											todoStatus: todo.todoStatus === 'completed' ? 'pending' : 'completed',
											completedAt: todo.todoStatus === 'completed' ? undefined : Date.now()
										})}
										class="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600"
									/>
									<div class="flex-1 min-w-0">
										<h3 class="font-medium text-sm {todo.todoStatus === 'completed' ? 'line-through opacity-60' : ''} {isOverdue(todo) ? 'text-red-700 dark:text-red-300' : 'text-foreground'}">
											{todo.title}
										</h3>
										{#if todo.dueDate}
											<p class="text-xs mt-1 {isOverdue(todo) ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}">
												{isOverdue(todo) ? '⚠️ 기한초과' : '📅'}
												{new Date(todo.dueDate).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })}
												{#if todo.dueTime && todo.dueTime !== '23:59'}
													{todo.dueTime}
												{/if}
											</p>
										{:else}
											<p class="text-xs text-muted-foreground mt-1">기한 없음</p>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- 즐겨찾기 -->
			{#if favoriteMemos.length > 0}
				<section>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-base font-semibold flex items-center gap-2">
							<Star class="w-4 h-4 text-yellow-500" />
							즐겨찾기
						</h2>
						<a href="/memos?filter=favorites" class="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
							더보기 <ChevronRight class="w-4 h-4" />
						</a>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{#each favoriteMemos as memo (memo.id)}
							<MemoCard
								{memo}
								compact
								onClick={handleView}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTogglePin={(id) => memosStore.togglePin(id)}
								onToggleFavorite={(id) => memosStore.toggleFavorite(id)}
								onToggleActive={(id) => memosStore.toggleActive(id)}
							/>
						{/each}
					</div>
				</section>
			{/if}

			<!-- 알림 예정 -->
			{#if upcomingReminders.length > 0}
				<section>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-base font-semibold flex items-center gap-2">
							<Bell class="w-4 h-4 text-orange-500" />
							알림 예정
						</h2>
						<button
							onclick={() => showRemindersModal = true}
							class="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
						>
							더보기 <ChevronRight class="w-4 h-4" />
						</button>
					</div>
					<div class="space-y-2">
						{#each upcomingReminders as memo (memo.id)}
							<button
								onclick={() => handleView(memo)}
								class="w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors text-left"
							>
								<div class="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
									<Bell class="w-5 h-5 text-orange-500" />
								</div>
								<div class="flex-1 min-w-0">
									<p class="font-medium truncate">{memo.title || '제목 없음'}</p>
									<p class="text-sm text-muted-foreground">
										{formatReminderTime(memo.reminder!.datetime!)}
									</p>
								</div>
								<ChevronRight class="w-4 h-4 text-muted-foreground shrink-0" />
							</button>
						{/each}
					</div>
				</section>
			{/if}

			<!-- 최신 메모 -->
			{#if recentMemos.length > 0}
				<section>
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-base font-semibold flex items-center gap-2">
							<Clock class="w-4 h-4 text-muted-foreground" />
							최신 메모
						</h2>
						<a href="/memos" class="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
							전체 보기 <ChevronRight class="w-4 h-4" />
						</a>
					</div>
					<div class="space-y-2">
						{#each recentMemos as memo (memo.id)}
							<MemoCard
								{memo}
								compact
								ultraCompact
								onClick={handleView}
								onEdit={handleEdit}
								onDelete={handleDelete}
								onTogglePin={(id) => memosStore.togglePin(id)}
								onToggleFavorite={(id) => memosStore.toggleFavorite(id)}
								onToggleActive={(id) => memosStore.toggleActive(id)}
							/>
						{/each}
					</div>
				</section>
			{/if}

			<!-- 메모는 있지만 모든 섹션이 비어있는 경우 -->
			{#if pinnedMemos.length === 0 && favoriteMemos.length === 0 && upcomingReminders.length === 0 && recentMemos.length === 0}
				<div class="flex flex-col items-center justify-center py-8 text-center">
					<p class="text-muted-foreground mb-4">활성화된 메모가 없습니다</p>
					<a href="/memos" class="text-primary hover:underline flex items-center gap-1">
						전체 메모 보기 <ChevronRight class="w-4 h-4" />
					</a>
				</div>
			{/if}
		{/if}
	</main>
</div>

<!-- FAB (Floating Action Button) -->
{#if !showForm}
	<button
		onclick={handleCreateNew}
		class="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform transition-opacity duration-200 {fabVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
		aria-label="새 메모 작성"
	>
		<Plus class="w-6 h-6" />
	</button>
{/if}

<!-- Modals -->
<MemoForm
	bind:open={showForm}
	memo={editingMemo}
	onClose={handleFormClose}
/>

<DeleteConfirmDialog
	bind:open={showDeleteDialog}
	title={deletingMemo?.title}
	onConfirm={confirmDelete}
	onCancel={() => (deletingMemo = null)}
/>

<MemoDetailModal
	bind:open={showDetailModal}
	memo={viewingMemo}
	onClose={handleDetailClose}
	onEdit={handleEdit}
	onDelete={handleDelete}
	onShare={handleShare}
/>

<ScheduledRemindersModal
	bind:open={showRemindersModal}
	onClose={() => showRemindersModal = false}
	onMemoClick={handleEdit}
/>

<ShareModal
	bind:open={showShareModal}
	memo={sharingMemo}
	onClose={handleShareClose}
/>

{#if showOnboarding}
	<OnboardingModal
		onClose={() => {
			showOnboarding = false;
			if (typeof window !== 'undefined') {
				localStorage.setItem(ONBOARDING_KEY, 'true');
			}
			if (!onboardingStore.hasSeenSwipeGuide) {
				showSwipeGuide = true;
			}
		}}
	/>
{/if}

<SwipeGuideModal
	bind:open={showSwipeGuide}
	onClose={() => showSwipeGuide = false}
/>
