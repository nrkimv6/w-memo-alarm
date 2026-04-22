// FCM (Firebase Cloud Messaging) - 웹/PWA 전용
// Service Worker 기반 Web Push 알림

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { browser } from '$app/environment';
import { supabase } from './services/supabase';
import {
	PUBLIC_FIREBASE_API_KEY,
	PUBLIC_FIREBASE_AUTH_DOMAIN,
	PUBLIC_FIREBASE_PROJECT_ID,
	PUBLIC_FIREBASE_STORAGE_BUCKET,
	PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	PUBLIC_FIREBASE_APP_ID,
	PUBLIC_FIREBASE_VAPID_KEY
} from '$env/static/public';

// Firebase 설정
const firebaseConfig = {
	apiKey: PUBLIC_FIREBASE_API_KEY,
	authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: PUBLIC_FIREBASE_APP_ID
};

// Firebase 설정 검증 (환경 변수 누락 시 경고)
if (browser && !firebaseConfig.apiKey) {
	console.warn('[FCM] Firebase API key not configured - check .env file');
}

// FCM 환경 상태 조회 (개발자 모드용)
// settings devMode 비교용 식별자만 노출하며 API/VAPID 키 원문은 반환하지 않는다.
export function getFCMConfigStatus() {
	return {
		hasApiKey: !!PUBLIC_FIREBASE_API_KEY,
		hasVapidKey: !!PUBLIC_FIREBASE_VAPID_KEY,
		projectId: PUBLIC_FIREBASE_PROJECT_ID || null,
		envProjectId: PUBLIC_FIREBASE_PROJECT_ID || null,
		messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID || null,
		isConfigured: !!PUBLIC_FIREBASE_API_KEY && !!PUBLIC_FIREBASE_VAPID_KEY && !!PUBLIC_FIREBASE_PROJECT_ID
	};
}

// Firebase 초기화
const app = browser && firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;
const messaging = app ? getMessaging(app) : null;

if (browser && !app) {
	console.error('[FCM] Firebase initialization failed - check .env file and restart dev server');
}

export interface FCMToken {
	token: string;
	platform: 'web';
}

/**
 * FCM 토큰 발급 및 Supabase 등록 (웹/PWA)
 */
export async function registerFCMToken(userId: string): Promise<FCMToken | null> {
	if (!browser || !messaging || !supabase) {
		console.warn('FCM not available (browser only)');
		return null;
	}

	try {
		// 1. 알림 권한 요청
		const permission = await Notification.requestPermission();

		if (permission !== 'granted') {
			console.warn('Notification permission denied');
			return null;
		}

		// 2. Service Worker 등록 확인
		const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

		// 3. FCM 토큰 발급 (VAPID 키 사용)
		if (!PUBLIC_FIREBASE_VAPID_KEY) {
			throw new Error('VAPID key not configured');
		}

		const fcmToken = await getToken(messaging, {
			vapidKey: PUBLIC_FIREBASE_VAPID_KEY,
			serviceWorkerRegistration: registration
		});

		if (!fcmToken) {
			throw new Error('Failed to get FCM token');
		}

		// 4. Supabase에 저장
		const { error } = await supabase.from('user_devices').upsert(
			{
				user_id: userId,
				app_name: 'memo-alarm',
				platform: 'web',
				fcm_token: fcmToken,
				is_active: true,
				updated_at: new Date().toISOString()
			},
			{
				onConflict: 'user_id,app_name,fcm_token'
			}
		);

		if (error) {
			console.error('Failed to save FCM token to Supabase:', error);
			throw error;
		}

		return { token: fcmToken, platform: 'web' };
	} catch (error) {
		console.error('FCM token registration failed:', error);
		return null;
	}
}

/**
 * 포그라운드 메시지 리스너 설정
 */
export function setupForegroundMessageListener() {
	if (!browser || !messaging) {
		return;
	}

	onMessage(messaging, (payload) => {
		// 포그라운드에서 알림 표시
		if (Notification.permission === 'granted' && payload.notification) {
			new Notification(payload.notification.title || 'Notification', {
				body: payload.notification.body,
				icon: '/favicon.png',
				tag: 'memo-alarm-notification',
				requireInteraction: false
			});
		}
	});
}

/**
 * FCM 토큰 비활성화 (로그아웃 시)
 */
export async function deactivateFCMToken(userId: string, token: string): Promise<void> {
	if (!supabase) {
		console.warn('Supabase not configured');
		return;
	}

	try {
		const { error } = await supabase
			.from('user_devices')
			.update({ is_active: false, updated_at: new Date().toISOString() })
			.eq('user_id', userId)
			.eq('fcm_token', token);

		if (error) {
			console.error('Failed to deactivate FCM token:', error);
			throw error;
		}

	} catch (error) {
		console.error('FCM token deactivation failed:', error);
	}
}

/**
 * 사용자의 모든 FCM 토큰 비활성화
 */
export async function deactivateAllFCMTokens(userId: string): Promise<void> {
	if (!supabase) {
		console.warn('Supabase not configured');
		return;
	}

	try {
		const { error } = await supabase
			.from('user_devices')
			.update({ is_active: false, updated_at: new Date().toISOString() })
			.eq('user_id', userId)
			.eq('app_name', 'memo-alarm');

		if (error) {
			console.error('Failed to deactivate all FCM tokens:', error);
			throw error;
		}

	} catch (error) {
		console.error('FCM tokens deactivation failed:', error);
	}
}

/**
 * 비활성화된 토큰이 있는지 확인
 * 서버에서 NotRegistered 에러로 비활성화된 토큰이 있으면 true 반환
 */
export async function hasDeactivatedToken(userId: string): Promise<boolean> {
	if (!supabase) {
		return false;
	}

	try {
		const { data, error } = await supabase
			.from('user_devices')
			.select('id, is_active, updated_at')
			.eq('user_id', userId)
			.eq('app_name', 'memo-alarm')
			.eq('is_active', false);

		if (error) {
			console.error('Failed to check deactivated tokens:', error);
			return false;
		}

		// 비활성화된 토큰이 있으면 true
		return data && data.length > 0;
	} catch (error) {
		console.error('Error checking deactivated tokens:', error);
		return false;
	}
}

/**
 * 비활성화된 토큰 삭제 후 새 토큰 등록
 * 사용자가 "알림 재설정"을 선택했을 때 호출
 */
export async function resetFCMToken(userId: string): Promise<FCMToken | null> {
	if (!supabase) {
		return null;
	}

	try {
		// 1. 기존 비활성화된 토큰 삭제
		const { error: deleteError } = await supabase
			.from('user_devices')
			.delete()
			.eq('user_id', userId)
			.eq('app_name', 'memo-alarm')
			.eq('is_active', false);

		if (deleteError) {
			console.error('Failed to delete deactivated tokens:', deleteError);
		}

		// 2. 새 토큰 등록
		return await registerFCMToken(userId);
	} catch (error) {
		console.error('Failed to reset FCM token:', error);
		return null;
	}
}
