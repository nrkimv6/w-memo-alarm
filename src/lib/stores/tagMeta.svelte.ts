import type { TagMeta } from '$lib/types/memo';

const STORAGE_KEY = 'memo-alarm-tag-meta';

function loadFromStorage(): Record<string, TagMeta> {
	if (typeof window === 'undefined') return {};
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (data) {
			return JSON.parse(data);
		}
		return {};
	} catch {
		return {};
	}
}

function saveToStorage(map: Record<string, TagMeta>): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
	} catch {
		// ignore
	}
}

function createTagMetaStore() {
	let metaMap = $state<Record<string, TagMeta>>({});
	let initialized = $state(false);

	function init() {
		if (initialized) return;
		metaMap = loadFromStorage();
		initialized = true;
	}

	function getTagMeta(tag: string): TagMeta {
		return metaMap[tag] ?? { name: tag, alwaysVisible: true };
	}

	function isTagVisible(tag: string): boolean {
		return getTagMeta(tag).alwaysVisible;
	}

	function setAlwaysVisible(tag: string, value: boolean): void {
		metaMap = { ...metaMap, [tag]: { name: tag, alwaysVisible: value } };
		saveToStorage(metaMap);
	}

	return {
		get metaMap() {
			return metaMap;
		},
		init,
		getTagMeta,
		isTagVisible,
		setAlwaysVisible
	};
}

export const tagMetaStore = createTagMetaStore();
