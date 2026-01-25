<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, FileText, CheckSquare, X, Merge, Trash2 } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { FilterTabs } from '$lib/components/layout';
	import {
		MemoForm,
		MemoCard,
		MemoDetailModal,
		DeleteConfirmDialog,
		SearchBar,
		TagFilter,
		FolderTabs,
		ShareModal
	} from '$lib/components/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { filterStore } from '$lib/stores/filter.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { Memo } from '$lib/types/memo';
	import { cn, mergeMemos } from '$lib/utils';

	let showForm = $state(false);
	let showDeleteDialog = $state(false);
	let showDeleteSelectedDialog = $state(false);
	let showDetailModal = $state(false);
	let showShareModal = $state(false);
	let editingMemo = $state<Memo | null>(null);
	let deletingMemo = $state<Memo | null>(null);
	let viewingMemo = $state<Memo | null>(null);
	let sharingMemo = $state<Memo | null>(null);

	const filteredMemos = $derived(filterStore.getFilteredMemos());
	const viewMode = $derived(filterStore.viewMode);
	const allTags = $derived(memosStore.getAllTags());
	const hasFolders = $derived(foldersStore.folders.length > 0);
	const isSelectionMode = $derived(selectionStore.isSelectionMode);
	const selectedCount = $derived(selectionStore.selectedCount);

	onMount(() => {
		// memosStore, filterStore, foldersStore 초기화는 +layout.svelte에서 수행됨

		// Keyboard shortcuts
		function handleKeydown(e: KeyboardEvent) {
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
				if (e.key === 'Escape') {
					target.blur();
				}
				return;
			}

			if (e.key === 'n' || e.key === 'N') {
				e.preventDefault();
				handleCreateNew();
			}

			if (e.key === '/') {
				e.preventDefault();
				const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
				searchInput?.focus();
			}

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
		sharingMemo = memo;
		showShareModal = true;
	}

	function handleShareClose() {
		showShareModal = false;
		sharingMemo = null;
	}

	function handleStartSelection() {
		selectionStore.startSelection();
	}

	function handleEndSelection() {
		selectionStore.endSelection();
	}

	function handleSelectAll() {
		selectionStore.selectAll(filteredMemos.map((m) => m.id));
	}

	function handleMergeSelected() {
		const ids = Array.from(selectionStore.selectedIds);
		if (ids.length < 2) {
			toastStore.error('2개 이상의 메모를 선택하세요');
			return;
		}

		const mergedMemo = mergeMemos(ids);
		if (!mergedMemo) {
			toastStore.error('병합에 실패했습니다');
			return;
		}

		memosStore.add(mergedMemo);
		ids.forEach((id) => memosStore.remove(id));

		toastStore.success(`${ids.length}개의 메모가 병합되었습니다`);
		selectionStore.endSelection();
	}

	function handleDeleteSelected() {
		const ids = Array.from(selectionStore.selectedIds);
		if (ids.length === 0) return;
		showDeleteSelectedDialog = true;
	}

	function confirmDeleteSelected() {
		const ids = Array.from(selectionStore.selectedIds);
		ids.forEach((id) => memosStore.remove(id));
		toastStore.success(`${ids.length}개의 메모가 삭제되었습니다`);
		selectionStore.endSelection();
		showDeleteSelectedDialog = false;
	}
</script>

<div class="min-h-screen">
	<!-- Filter section -->
	<div class="sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50">
		<div class="max-w-6xl mx-auto px-4 py-4 space-y-4">
			<!-- Title and Create button -->
			<div class="flex items-center justify-between gap-4">
				<h1 class="text-xl font-bold tracking-tight text-foreground shrink-0">전체 메모</h1>
				{#if isSelectionMode}
					<div class="flex items-center gap-2">
						<span class="text-sm text-muted-foreground">{selectedCount}개 선택됨</span>
						<Button variant="ghost" onclick={handleSelectAll} size="sm">
							전체 선택
						</Button>
						<Button variant="secondary" onclick={handleMergeSelected} disabled={selectedCount < 2} size="sm">
							<Merge class="w-4 h-4" />
							병합
						</Button>
						<Button variant="destructive" onclick={handleDeleteSelected} disabled={selectedCount === 0} size="sm">
							<Trash2 class="w-4 h-4" />
							삭제
						</Button>
						<Button variant="ghost" onclick={handleEndSelection} size="sm">
							<X class="w-4 h-4" />
							취소
						</Button>
					</div>
				{:else}
					<div class="flex items-center gap-2">
						<Button variant="ghost" onclick={handleStartSelection} class="shrink-0" title="선택 모드">
							<CheckSquare class="w-4 h-4" />
						</Button>
						<Button onclick={handleCreateNew} class="shrink-0">
							<Plus class="w-4 h-4" />
							<span class="hidden sm:inline">새 메모</span>
						</Button>
					</div>
				{/if}
			</div>

			<!-- 검색 영역 -->
			<SearchBar />

			<!-- 필터/정렬 영역 -->
			<div class="pt-2 border-t border-border/30 space-y-3">
				<FilterTabs />

				{#if hasFolders}
					<FolderTabs />
				{/if}

				{#if allTags.length > 0}
					<TagFilter />
				{/if}
			</div>
		</div>
	</div>

	<!-- Main content -->
	<main class="max-w-6xl mx-auto px-4 py-6">
		{#if filteredMemos.length === 0}
			<div class="flex flex-col items-center justify-center py-8 text-center">
				<div class="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
					<FileText class="w-6 h-6 text-muted-foreground" />
				</div>
				<h2 class="text-lg font-semibold mb-1">메모가 없습니다</h2>
				<p class="text-sm text-muted-foreground mb-4">첫 번째 메모를 작성해보세요!</p>
				<Button onclick={handleCreateNew} size="sm">
					<Plus class="w-4 h-4" />
					새 메모 만들기
				</Button>
			</div>
		{:else}
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

<DeleteConfirmDialog
	bind:open={showDeleteSelectedDialog}
	message={`${selectedCount}개의 메모를 삭제하시겠습니까?`}
	onConfirm={confirmDeleteSelected}
	onCancel={() => (showDeleteSelectedDialog = false)}
/>

<MemoDetailModal
	bind:open={showDetailModal}
	memo={viewingMemo}
	onClose={handleDetailClose}
	onEdit={handleEdit}
	onDelete={handleDelete}
	onShare={handleShare}
/>

<ShareModal
	bind:open={showShareModal}
	memo={sharingMemo}
	onClose={handleShareClose}
/>
