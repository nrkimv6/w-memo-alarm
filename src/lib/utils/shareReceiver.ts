/**
 * 외부 앱에서 공유받은 데이터를 처리하는 유틸리티
 * - PWA Web Share Target API
 * - Android Intent (Capacitor)
 */

import type { Memo, MemoType } from '$lib/types/memo';

export interface SharedData {
	title?: string;
	text?: string;
	url?: string;
	source: 'pwa' | 'native';
}

export interface ParsedShareData {
	title: string;
	content: string;
	url?: string;
	memoType: MemoType;
}

/**
 * URL 파라미터에서 공유 데이터 파싱 (PWA Web Share Target)
 */
export function parseSharedDataFromParams(params: URLSearchParams): SharedData | null {
	const title = params.get('title') || undefined;
	const text = params.get('text') || undefined;
	const rawUrl = params.get('url') || undefined;
	const url = sanitizeSharedUrl(rawUrl);

	// 공유 데이터가 하나도 없으면 null 반환
	if (!title && !text && !url) {
		return null;
	}

	return {
		title,
		text,
		url,
		source: 'pwa'
	};
}

function sanitizeSharedUrl(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
		return url;
	} catch {
		return undefined;
	}
}

/**
 * 텍스트에서 URL 추출
 * 트위터, 카카오톡 등에서 텍스트와 URL이 혼합되어 공유될 때 사용
 */
export function extractUrlFromText(text: string): { url?: string; cleanText: string } {
	// URL 정규식 (http, https)
	const urlRegex = /(https?:\/\/[^\s]+)/gi;
	const matches = text.match(urlRegex);

	if (!matches || matches.length === 0) {
		return { cleanText: text.trim() };
	}

	// 첫 번째 URL 추출
	const url = matches[0];

	// URL 제거한 텍스트
	let cleanText = text.replace(urlRegex, '').trim();

	// 여러 공백을 하나로 정리
	cleanText = cleanText.replace(/\s+/g, ' ').trim();

	return { url, cleanText };
}

/**
 * 공유 데이터로 메모 타입 결정
 * - URL이 있으면 bookmark
 * - 없으면 note
 */
export function determineMemoType(data: SharedData): MemoType {
	// 명시적 URL이 있거나, 텍스트에서 URL이 추출되면 bookmark
	if (data.url) {
		return 'bookmark';
	}

	if (data.text) {
		const { url } = extractUrlFromText(data.text);
		if (url) {
			return 'bookmark';
		}
	}

	return 'note';
}

/**
 * 도메인에서 사이트 이름 추출
 */
function getSiteNameFromUrl(url: string): string {
	try {
		const hostname = new URL(url).hostname;
		// www. 제거
		const domain = hostname.replace(/^www\./, '');
		// 첫 번째 점 이전 부분 (예: youtube.com -> youtube)
		const siteName = domain.split('.')[0];
		// 첫 글자 대문자
		return siteName.charAt(0).toUpperCase() + siteName.slice(1);
	} catch {
		return '';
	}
}

/**
 * 공유 데이터를 메모 폼 초기값으로 변환
 */
export function sharedDataToMemoDefaults(data: SharedData): ParsedShareData {
	const memoType = determineMemoType(data);
	let title = data.title || '';
	let content = '';
	let url = data.url;

	// 텍스트 처리
	if (data.text) {
		const extracted = extractUrlFromText(data.text);

		// URL이 텍스트에서 추출된 경우
		if (extracted.url && !url) {
			url = extracted.url;
		}

		// 나머지 텍스트는 내용으로
		if (extracted.cleanText) {
			content = extracted.cleanText;
		}
	}

	// 제목이 없는 경우 자동 생성
	if (!title) {
		if (url) {
			// URL이 있으면 사이트 이름 사용
			title = getSiteNameFromUrl(url) || '공유된 링크';
		} else if (content) {
			// 내용의 첫 줄 사용 (최대 50자)
			const firstLine = content.split('\n')[0];
			title = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
		} else {
			title = '공유된 메모';
		}
	}

	return {
		title,
		content,
		url,
		memoType
	};
}

/**
 * 공유 데이터를 Memo 객체 형태로 변환 (저장 전 미리보기용)
 */
export function sharedDataToPartialMemo(data: SharedData): Partial<Memo> {
	const parsed = sharedDataToMemoDefaults(data);

	return {
		title: parsed.title,
		content: parsed.content,
		url: parsed.url,
		memoType: parsed.memoType,
		tags: [],
		isPinned: false,
		isFavorite: false,
		isActive: true
	};
}

/**
 * Android Intent에서 받은 데이터 파싱
 * Intent extras: EXTRA_TEXT, EXTRA_SUBJECT
 */
export function parseAndroidIntent(extras: {
	'android.intent.extra.TEXT'?: string;
	'android.intent.extra.SUBJECT'?: string;
}): SharedData | null {
	const text = extras['android.intent.extra.TEXT'];
	const subject = extras['android.intent.extra.SUBJECT'];

	if (!text && !subject) {
		return null;
	}

	return {
		title: subject,
		text: text,
		source: 'native'
	};
}
