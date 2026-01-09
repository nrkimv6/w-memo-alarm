import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendScheduledPushNotifications } from '$lib/server/web-push';

// Cron에서 호출되는 Push 발송 API
// 매분 호출하여 현재 시간에 알림이 필요한 사용자에게 Web Push 발송
export const GET: RequestHandler = async ({ platform, request }) => {
	// 보안: Cron-Only 헤더 또는 시크릿 키 확인
	const cronSecret = request.headers.get('X-Cron-Secret');
	const expectedSecret = platform?.env?.CRON_SECRET;

	if (expectedSecret && cronSecret !== expectedSecret) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const db = platform?.env?.DB;
	if (!db) {
		return json({ error: 'Database not available' }, { status: 503 });
	}

	const vapidPublicKey = platform?.env?.VAPID_PUBLIC_KEY;
	const vapidPrivateKey = platform?.env?.VAPID_PRIVATE_KEY;
	const vapidSubject = platform?.env?.VAPID_SUBJECT || 'mailto:.contact@woory.day';

	if (!vapidPublicKey || !vapidPrivateKey) {
		return json({ error: 'VAPID keys not configured' }, { status: 500 });
	}

	try {
		const result = await sendScheduledPushNotifications(
			db,
			vapidPublicKey,
			vapidPrivateKey,
			vapidSubject
		);

		return json({
			success: true,
			timestamp: new Date().toISOString(),
			...result
		});
	} catch (error) {
		console.error('Cron send-push error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// POST도 지원 (외부 cron 서비스 호환)
export const POST: RequestHandler = GET;
