import type { Memo } from '$lib/types/memo';
import { toastStore } from '$lib/stores/toast.svelte';

export interface ShareData {
	title: string;
	text: string;
	url?: string;
}

export function formatMemoForShare(memo: Memo): ShareData {
	let text = memo.title;
	if (memo.content) {
		text += `\n\n${memo.content}`;
	}
	if (memo.tags.length > 0) {
		text += `\n\n#${memo.tags.join(' #')}`;
	}

	return {
		title: memo.title,
		text,
		url: memo.url
	};
}

export async function shareMemo(memo: Memo): Promise<boolean> {
	const shareData = formatMemoForShare(memo);

	// Try native Share API first
	if (navigator.share && canShare(shareData)) {
		try {
			await navigator.share(shareData);
			toastStore.success('공유되었습니다');
			return true;
		} catch (err) {
			if ((err as Error).name !== 'AbortError') {
				// User cancelled, not an error
				console.error('Share failed:', err);
			}
			return false;
		}
	}

	// Fallback to clipboard
	return copyToClipboard(memo);
}

export async function copyToClipboard(memo: Memo): Promise<boolean> {
	const shareData = formatMemoForShare(memo);
	let textToCopy = shareData.text;
	if (shareData.url) {
		textToCopy += `\n\n${shareData.url}`;
	}

	try {
		await navigator.clipboard.writeText(textToCopy);
		toastStore.success('클립보드에 복사되었습니다');
		return true;
	} catch (err) {
		console.error('Clipboard write failed:', err);
		toastStore.error('복사에 실패했습니다');
		return false;
	}
}

export async function copyUrlToClipboard(url: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(url);
		toastStore.success('URL이 복사되었습니다');
		return true;
	} catch (err) {
		console.error('Clipboard write failed:', err);
		toastStore.error('복사에 실패했습니다');
		return false;
	}
}

function canShare(data: ShareData): boolean {
	if (!navigator.canShare) return true; // Assume it can share if canShare is not available
	return navigator.canShare(data);
}
