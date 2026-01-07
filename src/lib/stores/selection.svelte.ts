const STORAGE_KEY = 'memo-alarm:selection-mode';

function createSelectionStore() {
	let isSelectionMode = $state(false);
	let selectedIds = $state<Set<string>>(new Set());

	function startSelection() {
		isSelectionMode = true;
		selectedIds = new Set();
	}

	function endSelection() {
		isSelectionMode = false;
		selectedIds = new Set();
	}

	function toggleSelection(id: string) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function isSelected(id: string): boolean {
		return selectedIds.has(id);
	}

	function selectAll(ids: string[]) {
		selectedIds = new Set(ids);
	}

	function clearSelection() {
		selectedIds = new Set();
	}

	return {
		get isSelectionMode() {
			return isSelectionMode;
		},
		get selectedIds() {
			return selectedIds;
		},
		get selectedCount() {
			return selectedIds.size;
		},
		startSelection,
		endSelection,
		toggleSelection,
		isSelected,
		selectAll,
		clearSelection
	};
}

export const selectionStore = createSelectionStore();
