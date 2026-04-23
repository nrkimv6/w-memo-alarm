export function buildMergedTitle(count: number): string {
	return `${count}개의 메모 알림`;
}

export function buildMergedBody(titles: string[], maxItems = 4): string {
	if (titles.length === 0) return '';
	const shown = titles.slice(0, maxItems).map((t) => `• ${t}`).join('\n');
	const rest = titles.length - maxItems;
	return rest > 0 ? `${shown}\n외 ${rest}건` : shown;
}
