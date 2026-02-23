import { marked } from 'marked';

// marked 설정: 안전한 렌더링
marked.setOptions({
	breaks: true, // 줄바꿈 → <br>
	gfm: true // GitHub Flavored Markdown
});

/**
 * 마크다운 텍스트를 HTML로 변환
 * - XSS 방지: script, on* 이벤트 제거
 */
export function renderMarkdown(content: string): string {
	if (!content) return '';
	const html = marked.parse(content) as string;
	// 간단한 XSS 방지: script 태그와 on* 이벤트 핸들러 제거
	return html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
		.replace(/javascript:/gi, '');
}

/**
 * 마크다운 텍스트가 마크다운 문법을 포함하는지 감지
 */
export function hasMarkdownSyntax(text: string): boolean {
	if (!text) return false;
	// 주요 마크다운 패턴 감지
	const patterns = [
		/^#{1,6}\s/m, // 제목
		/\*\*.+\*\*/s, // 굵게
		/\*.+\*/s, // 기울임
		/~~.+~~/s, // 취소선
		/`[^`]+`/, // 인라인 코드
		/```[\s\S]*?```/, // 코드 블록
		/^\s*[-*+]\s/m, // 비순서 목록
		/^\s*\d+\.\s/m, // 순서 목록
		/^\s*>/m, // 인용문
		/\[.+\]\(.+\)/, // 링크
		/^\s*---+\s*$/m // 수평선
	];
	return patterns.some((pattern) => pattern.test(text));
}
