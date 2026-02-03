/**
 * 현재 시간을 HH:MM 형식으로 반환
 */
export function getCurrentTimeHHMM(date: Date = new Date()): string {
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 현재 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getTodayDateISO(date: Date = new Date()): string {
	return date.toISOString().split('T')[0];
}
