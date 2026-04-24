import type { Memo, Folder } from '$lib/types/memo';
import { memosStore } from '$lib/stores/memos.svelte';
import { foldersStore } from '$lib/stores/folders.svelte';
import { settingsStore } from '$lib/stores/settings.svelte';
import { authStore } from '$lib/stores/auth.svelte';
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
		todoRemindEnabled?: boolean;
		todoRemindTime?: string;
		todoAutoAlertEnabled?: boolean;
		todoAutoAlertMinutes?: number;
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
	const { defaultReminder, autoReminderOnCreate } = settingsStore.settings;
	return {
		version: 2,
		exportedAt: new Date().toISOString(),
		memos: memosStore.memos,
		folders: foldersStore.folders,
		settings: {
			defaultReminderTime: defaultReminder.time,
			defaultReminderDays: defaultReminder.days,
			autoReminderEnabled: autoReminderOnCreate,
			todoRemindEnabled: settingsStore.settings.todoDefaults.remind.enabled,
			todoRemindTime: settingsStore.settings.todoDefaults.remind.time,
			todoAutoAlertEnabled: settingsStore.settings.todoDefaults.autoAlert.enabled,
			todoAutoAlertMinutes: settingsStore.settings.todoDefaults.autoAlert.minutesBefore
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

				const validMemos = data.memos.filter(
					(m) => m.id && m.title !== undefined && Array.isArray(m.tags)
				);

				resolve(validMemos);
			} catch {
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

		if (!data.version || !Array.isArray(data.memos)) {
			return { success: false, message: '유효하지 않은 백업 파일입니다' };
		}

		let importedMemos = 0;
		let skippedMemos = 0;

		for (const memo of data.memos) {
			const existing = memosStore.getById(memo.id);
			if (existing) {
				if (memo.updatedAt > existing.updatedAt) {
					const cleaned = Object.fromEntries(
						Object.entries(memo).filter(([, v]) => v !== undefined)
					) as typeof memo;
					memosStore.update(memo.id, cleaned);
					importedMemos++;
				} else {
					skippedMemos++;
				}
			} else {
				memosStore.add(memo);
				importedMemos++;
			}
		}

		let importedFolders = 0;
		if (data.folders) {
			for (const folder of data.folders) {
				const existing = foldersStore.getById(folder.id);
				if (!existing) {
					foldersStore.addFolderWithId(folder);
					importedFolders++;
				}
			}
		}

		if (data.settings) {
			await settingsStore.setDefaultReminderTime(data.settings.defaultReminderTime);
			await settingsStore.setDefaultReminderDays(data.settings.defaultReminderDays);
			await settingsStore.setAutoReminderOnCreate(data.settings.autoReminderEnabled);
			if (typeof data.settings.todoRemindEnabled === 'boolean') {
				await settingsStore.setTodoRemindEnabled(data.settings.todoRemindEnabled);
			}
			if (data.settings.todoRemindTime) {
				await settingsStore.setTodoRemindTime(data.settings.todoRemindTime);
			}
			if (typeof data.settings.todoAutoAlertEnabled === 'boolean') {
				await settingsStore.setTodoAutoAlertEnabled(data.settings.todoAutoAlertEnabled);
			}
			if (typeof data.settings.todoAutoAlertMinutes === 'number') {
				await settingsStore.setTodoAutoAlertMinutes(data.settings.todoAutoAlertMinutes);
			}
		}

		const settingsMessage = data.settings
			? authStore.isAuthenticated
				? ', 알림 기본설정 계정 동기화 반영'
				: ', 알림 기본설정 로컬 복원'
			: '';
		const message = `가져오기 완료: 메모 ${importedMemos}개, 폴더 ${importedFolders}개${skippedMemos > 0 ? ` (${skippedMemos}개 건너뜀)` : ''}${settingsMessage}`;
		toastStore.success(message);
		return { success: true, message };
	} catch (err) {
		console.error('Import failed:', err);
		const message = '파일을 읽는 중 오류가 발생했습니다';
		toastStore.error(message);
		return { success: false, message };
	}
}

export async function clearAllData(): Promise<void> {
	await memosStore.removeAll();

	const folderIds = foldersStore.folders.map((f) => f.id);
	for (const id of folderIds) {
		await foldersStore.remove(id);
	}

	toastStore.success('모든 데이터가 삭제되었습니다');
}

export function mergeMemos(memoIds: string[]): Memo | null {
	if (memoIds.length < 2) return null;

	const memos = memoIds.map((id) => memosStore.getById(id)).filter((m): m is Memo => m !== null);
	if (memos.length < 2) return null;

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

export function findDuplicatesByUrl(): Map<string, Memo[]> {
	const urlMap = new Map<string, Memo[]>();

	for (const memo of memosStore.memos) {
		if (memo.url) {
			const existing = urlMap.get(memo.url) || [];
			existing.push(memo);
			urlMap.set(memo.url, existing);
		}
	}

	const duplicates = new Map<string, Memo[]>();
	for (const [url, memos] of urlMap) {
		if (memos.length > 1) {
			duplicates.set(url, memos);
		}
	}

	return duplicates;
}
