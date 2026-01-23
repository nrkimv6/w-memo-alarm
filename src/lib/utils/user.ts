import type { User } from '@supabase/supabase-js';

/**
 * 사용자 표시 이름 반환
 * - 카카오: user_metadata.name (닉네임)
 * - 구글: user_metadata.full_name 또는 email
 */
export function getUserDisplayName(user: User | null): string {
	if (!user) return '로그인하지 않음';

	const metadata = user.user_metadata;
	const provider = user.app_metadata?.provider || metadata?.provider;

	// 카카오: 닉네임 우선
	if (provider === 'kakao') {
		return metadata?.name || user.email || '카카오 사용자';
	}

	// 구글: full_name 우선
	if (provider === 'google') {
		return metadata?.full_name || user.email || '구글 사용자';
	}

	// 기타: full_name > name > email
	return metadata?.full_name || metadata?.name || user.email || '사용자';
}

/**
 * 사용자 프로필 이미지 URL 반환
 */
export function getUserAvatar(user: User | null): string | null {
	if (!user) return null;
	return user.user_metadata?.avatar_url || null;
}

/**
 * 사용자 이메일 가져오기
 * - 카카오: null 반환 (의미 없는 주소는 표시 안 함)
 * - 구글: 이메일 그대로 표시
 */
export function getUserEmail(user: User | null): string | null {
	if (!user || !user.email) return null;

	const email = user.email;
	const provider = user.app_metadata?.provider || user.user_metadata?.provider;

	// 카카오 로그인: 이메일 표시 안 함 (숫자@kakao.local 같은 의미 없는 주소)
	if (provider === 'kakao') {
		return null;
	}

	// @kakao.local로 끝나는 이메일도 표시 안 함 (provider 감지 실패 대비)
	if (email.endsWith('@kakao.local')) {
		return null;
	}

	// 구글 로그인: 이메일 표시
	return email;
}
