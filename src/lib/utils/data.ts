import type { Memo, Folder } from '$lib/types/memo';
import { memosStore } from '$lib/stores/memos.svelte';
import { foldersStore } from '$lib/stores/folders.svelte';
import { settingsStore } from '$lib/stores/settings.svelte';
import { toastStore } from '$lib/stores/toast.svelte';

export interface ExportData {
	version: number;
	exportedAt: string;
	memos: Memo[];
	folders?: Folder[];
	settings?: {
		defaultReminderTime: string;
		defaultReminderDays: number[];
		autoReminderEnabled: boolean;
	};
}

export function exportMemos(memos: Memo[]): string {
	const data: ExportData = {
		version: 1,
		exportedAt: new Date().toISOString(),
		memos
	};
	return JSON.stringify(data, null, 2);
}

export function exportAllData(): ExportData {
	return {
		version: 1,
		exportedAt: new Date().toISOString(),
		memos: memosStore.memos,
		folders: foldersStore.folders,
		settings: {
			defaultReminderTime: settingsStore.defaultReminderTime,
			defaultReminderDays: settingsStore.defaultReminderDays,
			autoReminderEnabled: settingsStore.autoReminderEnabled
		}
	};
}

export function downloadExport(memos: Memo[]): void {
	const data = exportMemos(memos);
	const blob = new Blob([data], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = `memo-alarm-backup-${new Date().toISOString().split('T')[0]}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export function downloadFullBackup(): void {
	const data = exportAllData();
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const date = new Date().toISOString().split('T')[0];
	const filename = `memo-alarm-full-backup-${date}.json`;

	const link = document.createElement('a');
	link.download = filename;
	link.href = url;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);

	toastStore.success(`백업 파일이 저장되었습니다: ${filename}`);
}

export async function importMemos(file: File): Promise<Memo[]> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const data = JSON.parse(content) as ExportData;

				if (!data.version || !Array.isArray(data.memos)) {
					throw new Error('Invalid backup file format');
				}

				// Validate memo structure
				const validMemos = data.memos.filter(
					(m) => m.id && m.title !== undefined && Array.isArray(m.tags)
				);

				resolve(validMemos);
			} catch (err) {
				reject(new Error('Failed to parse backup file'));
			}
		};

		reader.onerror = () => reject(new Error('Failed to read file'));
		reader.readAsText(file);
	});
}

export async function importFullBackup(
	file: File
): Promise<{ success: boolean; message: string }> {
	try {
		const text = await file.text();
		const data = JSON.parse(text) as ExportData;

		// Validate data structure
		if (!data.version || !Array.isArray(data.memos)) {
			return { success: false, message: '유효하지 않은 백업 파일입니다' };
		}

		// Import memos
		let importedMemos = 0;
		let skippedMemos = 0;

		for (const memo of data.memos) {
			const existing = memosStore.getById(memo.id);
			if (existing) {
				// Compare updatedAt and keep newer
				if (memo.updatedAt > existing.updatedAt) {
					memosStore.update(memo.id, memo);
					importedMemos++;
				} else {
					skippedMemos++;
				}
			} else {
				// Add new memo
				memosStore.add(memo);
				importedMemos++;
			}
		}

		// Import folders
		let importedFolders = 0;
		if (data.folders) {
			for (const folder of data.folders) {
				const existing = foldersStore.getById(folder.id);
				if (!existing) {
					foldersStore.add(folder);
					importedFolders++;
				}
			}
		}

		// Import settings
		if (data.settings) {
			settingsStore.setDefaultReminderTime(data.settings.defaultReminderTime);
			settingsStore.setDefaultReminderDays(data.settings.defaultReminderDays);
			settingsStore.setAutoReminderEnabled(data.settings.autoReminderEnabled);
		}

		const message = `가져오기 완료: 메모 ${importedMemos}개, 폴더 ${importedFolders}개${skippedMemos > 0 ? ` (${skippedMemos}개 건너뜀)` : ''}`;
		toastStore.success(message);
		return { success: true, message };
	} catch (err) {
		console.error('Import failed:', err);
		const message = '파일을 읽는 중 오류가 발생했습니다';
		toastStore.error(message);
		return { success: false, message };
	}
}

export function clearAllData(): void {
	// Clear memos
	const memoIds = memosStore.memos.map((m) => m.id);
	memoIds.forEach((id) => memosStore.remove(id));

	// Clear folders
	const folderIds = foldersStore.folders.map((f) => f.id);
	folderIds.forEach((id) => foldersStore.remove(id));

	toastStore.success('모든 데이터가 삭제되었습니다');
}

// Merge multiple memos into one
export function mergeMemos(memoIds: string[]): Memo | null {
	if (memoIds.length < 2) return null;

	const memos = memoIds.map((id) => memosStore.getById(id)).filter((m): m is Memo => m !== null);
	if (memos.length < 2) return null;

	// Sort by creation date (oldest first)
	memos.sort((a, b) => a.createdAt - b.createdAt);

	const firstMemo = memos[0];
	const allTags = [...new Set(memos.flatMap((m) => m.tags))];
	const allContent = memos
		.map((m) => {
			let content = '';
			if (m.title) content += `## ${m.title}\n`;
			if (m.content) content += m.content;
			if (m.url) content += `\n\n${m.url}`;
			return content;
		})
		.join('\n\n---\n\n');

	const mergedMemo: Memo = {
		id: crypto.randomUUID(),
		title: `병합된 메모 (${memos.length}개)`,
		content: allContent,
		tags: allTags,
		isPinned: memos.some((m) => m.isPinned),
		isFavorite: memos.some((m) => m.isFavorite),
		isActive: true,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		folderId: firstMemo.folderId
	};

	return mergedMemo;
}

// Find duplicate memos by URL
export function findDuplicatesByUrl(): Map<string, Memo[]> {
	const urlMap = new Map<string, Memo[]>();

	for (const memo of memosStore.memos) {
		if (memo.url) {
			const existing = urlMap.get(memo.url) || [];
			existing.push(memo);
			urlMap.set(memo.url, existing);
		}
	}

	// Filter to only include duplicates
	const duplicates = new Map<string, Memo[]>();
	for (const [url, memos] of urlMap) {
		if (memos.length > 1) {
			duplicates.set(url, memos);
		}
	}

	return duplicates;
}
