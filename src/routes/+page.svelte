<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Search, ChevronRight } from 'lucide-svelte';
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
	import PinnedMemosSection from '$lib/components/dashboard/PinnedMemosSection.svelte';
	import TodayTodosSection from '$lib/components/dashboard/TodayTodosSection.svelte';
	import FavoriteMemosSection from '$lib/components/dashboard/FavoriteMemosSection.svelte';
	import UpcomingRemindersSection from '$lib/components/dashboard/UpcomingRemindersSection.svelte';
	import RecentMemosSection from '$lib/components/dashboard/RecentMemosSection.svelte';
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
		// 알림 클릭으로 진입 시 ?memo= 파라미터 처리
		if (typeof window !== 'undefined') {
			const params = new URLSearchParams(window.location.search);
			const memoId = params.get('memo');
			if (memoId) {
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);

				let retryCount = 0;
				const MAX_RETRY = 15;
				const tryOpenMemo = () => {
					const memo = memosStore.getById(memoId);
					if (memo) {
						viewingMemo = memo;
						showDetailModal = true;
					} else if (!memosStore.initialized && retryCount < MAX_RETRY) {
						retryCount++;
						setTimeout(tryOpenMemo, 200);
					} else if (memosStore.initialized && !memo) {
						console.warn(`Memo ${memoId} not found`);
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
			{#if pinnedMemos.length > 0}
				<PinnedMemosSection memos={pinnedMemos} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
			{/if}

			{#if todayTodos.length > 0}
				<TodayTodosSection todos={todayTodos} />
			{/if}

			{#if favoriteMemos.length > 0}
				<FavoriteMemosSection memos={favoriteMemos} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
			{/if}

			{#if upcomingReminders.length > 0}
				<UpcomingRemindersSection
					reminders={upcomingReminders}
					onView={handleView}
					onShowAll={() => showRemindersModal = true}
					{formatReminderTime}
				/>
			{/if}

			{#if recentMemos.length > 0}
				<RecentMemosSection memos={recentMemos} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
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
