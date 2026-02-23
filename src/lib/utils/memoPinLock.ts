/**
 * Phase 21: 메모 잠금 - PIN 기반 로컬 잠금
 * PIN은 localStorage에 해시 형태로 저장
 * 잠긴 메모 접근 시 PIN 입력 요구
 */

const PIN_STORAGE_KEY = 'memo-alarm-pin';
const UNLOCK_SESSION_KEY = 'memo-alarm-unlocked';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30분 세션

/**
 * PIN 해시 생성 (간단한 해시 - 보안용이 아닌 식별용)
 */
async function hashPin(pin: string): Promise<string> {
	if (typeof crypto !== 'undefined' && crypto.subtle) {
		const encoder = new TextEncoder();
		const data = encoder.encode(pin + 'memo-alarm-salt');
		const hash = await crypto.subtle.digest('SHA-256', data);
		return Array.from(new Uint8Array(hash))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}
	// fallback: 단순 변환
	return btoa(pin + 'memo-alarm-salt');
}

/** PIN 설정 여부 확인 */
export function hasPinSet(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return !!localStorage.getItem(PIN_STORAGE_KEY);
}

/** PIN 설정 */
export async function setPin(pin: string): Promise<void> {
	const hash = await hashPin(pin);
	localStorage.setItem(PIN_STORAGE_KEY, hash);
}

/** PIN 제거 */
export function removePin(): void {
	localStorage.removeItem(PIN_STORAGE_KEY);
	localStorage.removeItem(UNLOCK_SESSION_KEY);
}

/** PIN 검증 */
export async function verifyPin(pin: string): Promise<boolean> {
	const stored = localStorage.getItem(PIN_STORAGE_KEY);
	if (!stored) return false;
	const hash = await hashPin(pin);
	return hash === stored;
}

/** 세션 잠금 해제 (30분간 유지) */
export function unlockSession(): void {
	const expiresAt = Date.now() + SESSION_TIMEOUT_MS;
	sessionStorage.setItem(UNLOCK_SESSION_KEY, String(expiresAt));
}

/** 세션이 잠금 해제 상태인지 확인 */
export function isSessionUnlocked(): boolean {
	if (typeof sessionStorage === 'undefined') return false;
	const expiresAt = sessionStorage.getItem(UNLOCK_SESSION_KEY);
	if (!expiresAt) return false;
	return Date.now() < Number(expiresAt);
}

/** 세션 잠금 */
export function lockSession(): void {
	sessionStorage.removeItem(UNLOCK_SESSION_KEY);
}
