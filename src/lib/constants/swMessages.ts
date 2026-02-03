/**
 * Service Worker ↔ Main Thread 메시지 타입 상수
 * 양쪽에서 동일한 문자열을 사용하기 위한 중앙 관리
 */
export const SW_MSG = {
	// SW 제어
	SKIP_WAITING: 'SKIP_WAITING',

	// 알림 테스트
	TEST_NOTIFICATION: 'TEST_NOTIFICATION',
	DELAYED_NOTIFICATION: 'DELAYED_NOTIFICATION',

	// 메모 리마인더 관리
	REGISTER_MEMO_REMINDERS: 'REGISTER_MEMO_REMINDERS',
	UPDATE_MEMO_REMINDER: 'UPDATE_MEMO_REMINDER',
	REMOVE_MEMO_REMINDER: 'REMOVE_MEMO_REMINDER',
	GET_SCHEDULED_REMINDERS: 'GET_SCHEDULED_REMINDERS',

	// 로깅
	SW_LOG: 'SW_LOG',
} as const;

export type SWMessageType = (typeof SW_MSG)[keyof typeof SW_MSG];
