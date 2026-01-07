<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, FileText } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { Header, FilterTabs } from '$lib/components/layout';
	import {
		MemoForm,
		MemoCard,
		MemoDetailModal,
		DeleteConfirmDialog,
		SearchBar,
		TagFilter,
		TodayReminders,
		FolderTabs,
		QuickMemoInput
	} from '$lib/components/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { filterStore } from '$lib/stores/filter.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { notificationStore } from '$lib/stores/notifications.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { Memo } from '$lib/types/memo';
	import { cn, shareMemo } from '$lib/utils';

	let showForm = $state(false);
	let showDeleteDialog = $state(false);
	let showDetailModal = $state(false);
	let editingMemo = $state<Memo | null>(null);
	let deletingMemo = $state<Memo | null>(null);
	let viewingMemo = $state<Memo | null>(null);

	const filteredMemos = $derived(filterStore.getFilteredMemos());
	const viewMode = $derived(filterStore.viewMode);
	const allTags = $derived(memosStore.getAllTags());
	const hasFolders = $derived(foldersStore.folders.length > 0);

	onMount(() => {
		memosStore.init();
		filterStore.init();
		foldersStore.init();
		notificationStore.init();

		// Keyboard shortcuts
		function handleKeydown(e: KeyboardEvent) {
			// Ignore if typing in input/textarea
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
				// Allow Escape to work even in inputs
				if (e.key === 'Escape') {
					target.blur();
				}
				return;
			}

			// N: New memo
			if (e.key === 'n' || e.key === 'N') {
				e.preventDefault();
				handleCreateNew();
			}

			// /: Focus search
			if (e.key === '/') {
				e.preventDefault();
				const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
				searchInput?.focus();
			}

			// Escape: Close modals
			if (e.key === 'Escape') {
				if (showDetailModal) {
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
		return () => window.removeEventListener('keydown', handleKeydown);
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
		shareMemo(memo);
	}
</script>

<div class="min-h-screen">
	<Header />

	<!-- Filter section -->
	<div class="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
		<div class="max-w-6xl mx-auto px-4 py-4 space-y-4">
			<!-- Title and Create button -->
			<div class="flex items-center justify-between gap-4">
				<h1 class="text-xl font-bold tracking-tight text-foreground shrink-0">메모 목록</h1>
				<div class="flex-1 max-w-md hidden sm:block">
					<QuickMemoInput />
				</div>
				<Button onclick={handleCreateNew} class="shrink-0">
					<Plus class="w-4 h-4" />
					<span class="hidden sm:inline">새 메모</span>
				</Button>
			</div>

			<!-- Quick memo input for mobile -->
			<div class="sm:hidden">
				<QuickMemoInput />
			</div>

			<!-- Search bar -->
			<SearchBar />

			<!-- Filter tabs and view mode -->
			<FilterTabs />

			<!-- Folder tabs -->
			{#if hasFolders}
				<FolderTabs />
			{/if}

			<!-- Tag filter -->
			{#if allTags.length > 0}
				<TagFilter />
			{/if}
		</div>
	</div>

	<!-- Main content -->
	<main class="max-w-6xl mx-auto px-4 py-6 space-y-6">
		<!-- 오늘의 알림 -->
		<TodayReminders onMemoClick={handleEdit} />

		{#if filteredMemos.length === 0}
			<!-- Empty state -->
			<div class="flex flex-col items-center justify-center py-20 text-center">
				<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
					<FileText class="w-8 h-8 text-muted-foreground" />
				</div>
				<h2 class="text-xl font-semibold mb-2">메모가 없습니다</h2>
				<p class="text-muted-foreground mb-6">첫 번째 메모를 작성해보세요!</p>
				<Button onclick={handleCreateNew}>
					<Plus class="w-4 h-4" />
					새 메모 만들기
				</Button>
			</div>
		{:else}
			<!-- Memo grid/list -->
			<div
				class={cn(
					viewMode === 'grid'
						? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
						: 'flex flex-col gap-3',
					viewMode === 'compact' && 'gap-1'
				)}
			>
				{#each filteredMemos as memo (memo.id)}
					<MemoCard
						{memo}
						compact={viewMode === 'list' || viewMode === 'compact'}
						ultraCompact={viewMode === 'compact'}
						onClick={handleView}
						onEdit={handleEdit}
						onDelete={handleDelete}
						onTogglePin={(id) => memosStore.togglePin(id)}
						onToggleFavorite={(id) => memosStore.toggleFavorite(id)}
						onToggleActive={(id) => memosStore.toggleActive(id)}
					/>
				{/each}
			</div>
		{/if}
	</main>
</div>

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
