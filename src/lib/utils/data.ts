import type { Memo } from '$lib/types/memo';

export interface ExportData {
	version: 1;
	exportedAt: string;
	memos: Memo[];
}

export function exportMemos(memos: Memo[]): string {
	const data: ExportData = {
		version: 1,
		exportedAt: new Date().toISOString(),
		memos
	};
	return JSON.stringify(data, null, 2);
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
				const validMemos = data.memos.filter((m) =>
					m.id && m.title !== undefined && Array.isArray(m.tags)
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
