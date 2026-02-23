/**
 * ID 생성 유틸리티 (순수 함수, 외부 의존성 없음)
 */

export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function generateLocalId(): string {
	return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateReminderId(): string {
	return `rem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
