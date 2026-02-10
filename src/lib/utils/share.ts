import type { Memo } from '$lib/types/memo';
import { toastStore } from '$lib/stores/toast.svelte';

export interface ShareData {
	title: string;
	text: string;
	url?: string;
}

/**
 * 메모를 공유용 데이터로 포맷합니다.
 *
 * @param memo - 공유할 메모
 * @returns ShareData - url은 북마크 URL(memo.url)이며, 일반 메모의 경우 undefined입니다.
 */
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
		url: memo.url // 북마크 URL (일반 메모는 undefined)
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

// SNS Share URLs
/**
 * Twitter 공유 URL을 생성합니다.
 * 제목, 내용(최대 200자), 태그를 포함하며, 북마크 URL이 있으면 함께 공유합니다.
 *
 * @param memo - 공유할 메모
 * @returns Twitter 공유 URL
 */
export function getTwitterShareUrl(memo: Memo): string {
	const shareData = formatMemoForShare(memo);
	let text = shareData.title;

	// 내용 추가 (트위터 글자 제한 고려)
	if (memo.content) {
		text += `\n${memo.content.slice(0, 200)}`;
		if (memo.content.length > 200) {
			text += '...';
		}
	}

	// 태그 추가
	if (memo.tags.length > 0) {
		text += ` #${memo.tags.join(' #')}`;
	}

	const params = new URLSearchParams({ text });

	// 북마크 URL이 있으면 함께 공유
	if (memo.url) {
		params.set('url', memo.url);
	}

	return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Facebook 공유 URL을 생성합니다.
 * Facebook은 URL이 필수이므로, memo.url이 없으면 빈 문자열을 반환합니다.
 *
 * @param memo - 공유할 메모
 * @returns Facebook 공유 URL 또는 빈 문자열
 */
export function getFacebookShareUrl(memo: Memo): string {
	if (!memo.url) return ''; // URL 없으면 공유 불가
	return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(memo.url)}&quote=${encodeURIComponent(memo.title)}`;
}

/**
 * Kakao 공유 URL을 생성합니다.
 * Kakao는 URL이 필수이므로, memo.url이 없으면 빈 문자열을 반환합니다.
 *
 * @param memo - 공유할 메모
 * @returns Kakao 공유 URL 또는 빈 문자열
 */
export function getKakaoShareUrl(memo: Memo): string {
	if (!memo.url) return ''; // URL 없으면 공유 불가
	const shareData = formatMemoForShare(memo);
	const text = encodeURIComponent(shareData.text);
	return `https://story.kakao.com/share?url=${encodeURIComponent(memo.url)}&text=${text}`;
}

export type SharePlatform = 'twitter' | 'facebook' | 'kakao' | 'copy' | 'native';

/**
 * SNS 플랫폼으로 메모를 공유합니다.
 * Facebook/Kakao는 URL이 없으면 안내 메시지를 표시하고 공유하지 않습니다.
 *
 * @param memo - 공유할 메모
 * @param platform - 공유 플랫폼
 */
export function shareToSNS(memo: Memo, platform: SharePlatform): void {
	let url: string;

	switch (platform) {
		case 'twitter':
			url = getTwitterShareUrl(memo);
			window.open(url, '_blank', 'width=600,height=400');
			break;
		case 'facebook':
			url = getFacebookShareUrl(memo);
			if (!url) {
				toastStore.info('URL이 없는 메모는 Facebook으로 공유할 수 없습니다');
				return;
			}
			window.open(url, '_blank', 'width=600,height=400');
			break;
		case 'kakao':
			url = getKakaoShareUrl(memo);
			if (!url) {
				toastStore.info('URL이 없는 메모는 Kakao로 공유할 수 없습니다');
				return;
			}
			window.open(url, '_blank', 'width=600,height=400');
			break;
		case 'copy':
			copyToClipboard(memo);
			break;
		case 'native':
		default:
			shareMemo(memo);
			break;
	}
}
