// Phase 15: AI 기반 기능 (로컬 분석)
import type { Memo } from '$lib/types/memo';

// 한국어 불용어 목록
const KOREAN_STOPWORDS = new Set([
	'이', '그', '저', '것', '수', '등', '들', '및', '에서', '으로', '에게',
	'하다', '되다', '있다', '없다', '같다', '아니다', '보다', '대한', '위해',
	'통해', '따라', '의해', '에서의', '으로의', '에게로', '그리고', '또는',
	'하지만', '그러나', '따라서', '그래서', '때문에', '위하여'
]);

// 영어 불용어 목록
const ENGLISH_STOPWORDS = new Set([
	'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
	'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
	'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for',
	'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
	'before', 'after', 'above', 'below', 'between', 'under', 'again',
	'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
	'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
	'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very'
]);

// 카테고리별 키워드
const CATEGORY_KEYWORDS: Record<string, string[]> = {
	'업무': ['회의', '프로젝트', '미팅', 'meeting', '보고서', '일정', '작업', 'task', 'work', '마감', 'deadline'],
	'개인': ['개인', '나', '나의', 'personal', 'my', '생각', '감정'],
	'쇼핑': ['구매', '주문', '쇼핑', '장바구니', 'buy', 'shop', 'order', '가격', '할인'],
	'건강': ['운동', '건강', '병원', '약', 'health', 'gym', '다이어트', '식단'],
	'학습': ['공부', '학습', '강의', '책', 'study', 'learn', 'course', '수업'],
	'여행': ['여행', '비행기', '호텔', '예약', 'travel', 'trip', 'flight', 'hotel'],
	'금융': ['돈', '계좌', '송금', '입금', '출금', 'money', 'bank', '결제', '카드'],
	'기술': ['코드', '개발', '프로그래밍', 'code', 'dev', 'api', 'bug', '서버', '배포'],
	'음식': ['음식', '요리', '레시피', '식당', 'food', 'recipe', '맛집', '메뉴'],
	'기타': []
};

/**
 * 텍스트에서 키워드 추출
 */
export function extractKeywords(text: string, maxKeywords = 10): string[] {
	if (!text) return [];

	// 특수문자 제거 및 소문자 변환
	const cleaned = text.toLowerCase().replace(/[^\w\s가-힣]/g, ' ');

	// 단어 분리
	const words = cleaned.split(/\s+/).filter(w => w.length >= 2);

	// 빈도 계산
	const frequency: Record<string, number> = {};
	for (const word of words) {
		if (KOREAN_STOPWORDS.has(word) || ENGLISH_STOPWORDS.has(word)) continue;
		frequency[word] = (frequency[word] || 0) + 1;
	}

	// 빈도순 정렬 후 상위 키워드 반환
	return Object.entries(frequency)
		.sort((a, b) => b[1] - a[1])
		.slice(0, maxKeywords)
		.map(([word]) => word);
}

/**
 * 메모 내용 기반 태그 추천
 */
export function suggestTags(memo: { title: string; content: string; url?: string }, existingTags: string[] = []): string[] {
	const text = `${memo.title} ${memo.content}`.toLowerCase();
	const suggestions: string[] = [];

	// 1. 카테고리 기반 태그 추천
	for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
		if (keywords.some(kw => text.includes(kw))) {
			if (!existingTags.includes(category)) {
				suggestions.push(category);
			}
		}
	}

	// 2. URL 기반 태그 추천
	if (memo.url) {
		const urlLower = memo.url.toLowerCase();
		if (urlLower.includes('github') || urlLower.includes('gitlab')) {
			if (!existingTags.includes('개발')) suggestions.push('개발');
		}
		if (urlLower.includes('youtube') || urlLower.includes('vimeo')) {
			if (!existingTags.includes('영상')) suggestions.push('영상');
		}
		if (urlLower.includes('twitter') || urlLower.includes('facebook') || urlLower.includes('instagram')) {
			if (!existingTags.includes('SNS')) suggestions.push('SNS');
		}
		if (urlLower.includes('amazon') || urlLower.includes('coupang') || urlLower.includes('11st')) {
			if (!existingTags.includes('쇼핑')) suggestions.push('쇼핑');
		}
		if (urlLower.includes('docs') || urlLower.includes('notion') || urlLower.includes('wiki')) {
			if (!existingTags.includes('문서')) suggestions.push('문서');
		}
	}

	// 3. 키워드 기반 태그 추천
	const keywords = extractKeywords(text, 3);
	for (const kw of keywords) {
		if (!existingTags.includes(kw) && !suggestions.includes(kw) && kw.length >= 2) {
			suggestions.push(kw);
		}
	}

	return suggestions.slice(0, 5);
}

/**
 * 관련 메모 추천
 */
export function findRelatedMemos(targetMemo: Memo, allMemos: Memo[], maxResults = 5): Memo[] {
	if (!targetMemo || allMemos.length === 0) return [];

	const targetText = `${targetMemo.title} ${targetMemo.content}`.toLowerCase();
	const targetKeywords = new Set(extractKeywords(targetText, 10));
	const targetTags = new Set(targetMemo.tags.map(t => t.toLowerCase()));

	const scores: { memo: Memo; score: number }[] = [];

	for (const memo of allMemos) {
		if (memo.id === targetMemo.id) continue;

		let score = 0;

		// 태그 일치 점수 (높은 가중치)
		const memoTags = memo.tags.map(t => t.toLowerCase());
		for (const tag of memoTags) {
			if (targetTags.has(tag)) score += 3;
		}

		// 키워드 일치 점수
		const memoText = `${memo.title} ${memo.content}`.toLowerCase();
		const memoKeywords = extractKeywords(memoText, 10);
		for (const kw of memoKeywords) {
			if (targetKeywords.has(kw)) score += 1;
		}

		// 같은 폴더 점수
		if (memo.folderId && memo.folderId === targetMemo.folderId) {
			score += 2;
		}

		if (score > 0) {
			scores.push({ memo, score });
		}
	}

	return scores
		.sort((a, b) => b.score - a.score)
		.slice(0, maxResults)
		.map(item => item.memo);
}

/**
 * 스마트 알림 시간 제안
 */
export function suggestReminderTime(memo: { title: string; content: string }): { time: string; reason: string } | null {
	const text = `${memo.title} ${memo.content}`.toLowerCase();

	// 아침 관련 키워드
	if (/아침|morning|출근|기상/.test(text)) {
		return { time: '07:00', reason: '아침 관련 내용으로 오전 7시 추천' };
	}

	// 점심 관련 키워드
	if (/점심|lunch|식사|밥/.test(text)) {
		return { time: '12:00', reason: '점심 관련 내용으로 정오 추천' };
	}

	// 저녁 관련 키워드
	if (/저녁|dinner|퇴근|evening/.test(text)) {
		return { time: '18:00', reason: '저녁 관련 내용으로 오후 6시 추천' };
	}

	// 밤 관련 키워드
	if (/밤|night|자기\s?전|취침/.test(text)) {
		return { time: '22:00', reason: '밤 관련 내용으로 오후 10시 추천' };
	}

	// 업무 관련 키워드
	if (/회의|미팅|meeting|업무|work/.test(text)) {
		return { time: '09:00', reason: '업무 관련 내용으로 오전 9시 추천' };
	}

	return null;
}

/**
 * 메모 요약 생성 (간단한 첫 문장 추출)
 */
export function generateSummary(content: string, maxLength = 100): string {
	if (!content) return '';

	// 첫 줄 또는 첫 문장 추출
	const firstLine = content.split('\n')[0].trim();
	const firstSentence = content.split(/[.!?。！？]/)[0].trim();

	const summary = firstLine.length <= firstSentence.length ? firstLine : firstSentence;

	if (summary.length <= maxLength) {
		return summary;
	}

	return summary.slice(0, maxLength - 3) + '...';
}
