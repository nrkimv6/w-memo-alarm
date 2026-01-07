import html2canvas from 'html2canvas';
import type { Memo } from '$lib/types/memo';
import { toastStore } from '$lib/stores/toast.svelte';

export async function captureElement(element: HTMLElement): Promise<string> {
	try {
		const canvas = await html2canvas(element, {
			backgroundColor: null,
			scale: 2,
			useCORS: true,
			logging: false
		});
		return canvas.toDataURL('image/png');
	} catch (err) {
		console.error('Element capture failed:', err);
		throw err;
	}
}

export function downloadImage(dataUrl: string, filename: string): void {
	const link = document.createElement('a');
	link.download = filename;
	link.href = dataUrl;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

export async function exportMemoAsImage(element: HTMLElement, memo: Memo): Promise<void> {
	try {
		const dataUrl = await captureElement(element);
		const filename = `memo-${memo.title?.slice(0, 20) || memo.id}.png`;
		downloadImage(dataUrl, filename);
		toastStore.success('이미지로 저장되었습니다');
	} catch (err) {
		console.error('Export failed:', err);
		toastStore.error('이미지 저장에 실패했습니다');
	}
}

export async function shareImage(element: HTMLElement, memo: Memo): Promise<boolean> {
	if (!navigator.share || !navigator.canShare) {
		// Fallback to download
		await exportMemoAsImage(element, memo);
		return true;
	}

	try {
		const canvas = await html2canvas(element, {
			backgroundColor: null,
			scale: 2,
			useCORS: true,
			logging: false
		});

		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((b) => {
				if (b) resolve(b);
				else reject(new Error('Blob creation failed'));
			}, 'image/png');
		});

		const file = new File([blob], `memo-${memo.id}.png`, { type: 'image/png' });

		if (navigator.canShare({ files: [file] })) {
			await navigator.share({
				files: [file],
				title: memo.title || '메모'
			});
			toastStore.success('공유되었습니다');
			return true;
		}
	} catch (err) {
		if ((err as Error).name !== 'AbortError') {
			console.error('Share image failed:', err);
		}
	}

	// Fallback to download
	await exportMemoAsImage(element, memo);
	return true;
}
