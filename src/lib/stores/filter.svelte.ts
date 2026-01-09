import type { FilterType, SortType, ViewMode, Memo } from '$lib/types/memo';
import { memosStore } from './memos.svelte';

const VIEW_MODE_KEY = 'memo-alarm-view-mode';

function loadViewMode(): ViewMode {
	if (typeof window === 'undefined') return 'grid';
	try {
		const saved = localStorage.getItem(VIEW_MODE_KEY);
		if (saved === 'list' || saved === 'compact') return saved;
		return 'grid';
	} catch {
		return 'grid';
	}
}

function saveViewMode(mode: ViewMode): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(VIEW_MODE_KEY, mode);
	} catch {
		// ignore
	}
}

export type TagFilterMode = 'or' | 'and';

function createFilterStore() {
	let filter = $state<FilterType>('all');
	let sort = $state<SortType>('recent');
	let searchQuery = $state('');
	let selectedTags = $state<string[]>([]);
	let selectedFolderId = $state<string | null>(null);
	let showInactive = $state(false);
	let viewMode = $state<ViewMode>('grid');
	let tagFilterMode = $state<TagFilterMode>('or');
	let initialized = $state(false);
	let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	function init() {
		if (initialized) return;
		viewMode = loadViewMode();
		initialized = true;
	}

	function setFolderId(folderId: string | null) {
		selectedFolderId = folderId;
	}

	function setShowInactive(value: boolean) {
		showInactive = value;
	}

	function setFilter(value: FilterType) {
		filter = value;
	}

	function setSort(value: SortType) {
		sort = value;
	}

	function setSearch(query: string) {
		// Debounce search to avoid excessive filtering
		if (searchDebounceTimer) {
			clearTimeout(searchDebounceTimer);
		}

		searchDebounceTimer = setTimeout(() => {
			searchQuery = query;
		}, 300);
	}

	function toggleTag(tag: string) {
		if (selectedTags.includes(tag)) {
			selectedTags = selectedTags.filter((t) => t !== tag);
		} else {
			selectedTags = [...selectedTags, tag];
		}
	}

	function clearTags() {
		selectedTags = [];
	}

	function setTagFilterMode(mode: TagFilterMode) {
		tagFilterMode = mode;
	}

	function toggleTagFilterMode() {
		tagFilterMode = tagFilterMode === 'or' ? 'and' : 'or';
	}

	function setViewMode(mode: ViewMode) {
		viewMode = mode;
		saveViewMode(mode);
	}

	function toggleViewMode() {
		const newMode = viewMode === 'grid' ? 'list' : 'grid';
		setViewMode(newMode);
	}

	function getFilteredMemos(): Memo[] {
		let result = [...memosStore.memos];

		// Filter by active status
		if (!showInactive) {
			result = result.filter((m) => m.isActive !== false);
		}

		// Filter by folder
		if (selectedFolderId !== null) {
			result = result.filter((m) => m.folderId === selectedFolderId);
		}

		// Filter by type
		if (filter === 'pinned') {
			result = result.filter((m) => m.isPinned);
		} else if (filter === 'favorites') {
			result = result.filter((m) => m.isFavorite);
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(m) =>
					m.title.toLowerCase().includes(query) ||
					m.content.toLowerCase().includes(query) ||
					m.tags.some((t) => t.toLowerCase().includes(query))
			);
		}

		// Filter by selected tags (AND/OR mode)
		if (selectedTags.length > 0) {
			if (tagFilterMode === 'and') {
				// AND: memo must have ALL selected tags
				result = result.filter((m) => selectedTags.every((t) => m.tags.includes(t)));
			} else {
				// OR: memo must have ANY of the selected tags
				result = result.filter((m) => selectedTags.some((t) => m.tags.includes(t)));
			}
		}

		// Sort
		result.sort((a, b) => {
			// Pinned items always first
			if (a.isPinned && !b.isPinned) return -1;
			if (!a.isPinned && b.isPinned) return 1;

			// Inactive items last (when showing inactive)
			if (showInactive) {
				if (a.isActive !== false && b.isActive === false) return -1;
				if (a.isActive === false && b.isActive !== false) return 1;
			}

			// Then sort by selected method
			switch (sort) {
				case 'oldest':
					return a.createdAt - b.createdAt;
				case 'title':
					return a.title.localeCompare(b.title);
				case 'updated':
					return b.updatedAt - a.updatedAt;
				case 'recent':
				default:
					return b.createdAt - a.createdAt;
			}
		});

		return result;
	}

	return {
		get filter() {
			return filter;
		},
		get sort() {
			return sort;
		},
		get searchQuery() {
			return searchQuery;
		},
		get selectedTags() {
			return selectedTags;
		},
		get selectedFolderId() {
			return selectedFolderId;
		},
		get showInactive() {
			return showInactive;
		},
		get viewMode() {
			return viewMode;
		},
		get tagFilterMode() {
			return tagFilterMode;
		},
		init,
		setFilter,
		setSort,
		setSearch,
		toggleTag,
		clearTags,
		setTagFilterMode,
		toggleTagFilterMode,
		setFolderId,
		setShowInactive,
		setViewMode,
		toggleViewMode,
		getFilteredMemos
	};
}

export const filterStore = createFilterStore();
