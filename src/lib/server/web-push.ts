// Web Push 발송 유틸리티 (Cloudflare Workers 호환)
// VAPID 인증 + 메시지 암호화 구현

interface PushSubscription {
	endpoint: string;
	p256dh: string;
	auth: string;
}

interface PushPayload {
	title: string;
	body: string;
	tag?: string;
	url?: string;
	memoId?: string;
}

// Base64 URL 인코딩/디코딩
function base64UrlEncode(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
	const padding = '='.repeat((4 - (str.length % 4)) % 4);
	const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

// VAPID JWT 생성
async function createVapidJwt(
	audience: string,
	subject: string,
	publicKey: string,
	privateKey: string,
	expiration: number
): Promise<string> {
	const header = { typ: 'JWT', alg: 'ES256' };
	const payload = {
		aud: audience,
		exp: expiration,
		sub: subject
	};

	const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
	const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
	const unsignedToken = `${headerB64}.${payloadB64}`;

	// Import private key
	const privateKeyBytes = base64UrlDecode(privateKey);
	const cryptoKey = await crypto.subtle.importKey(
		'pkcs8',
		privateKeyBytes,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['sign']
	);

	// Sign
	const signature = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		cryptoKey,
		new TextEncoder().encode(unsignedToken)
	);

	// Convert signature from DER to raw format (r || s)
	const signatureB64 = base64UrlEncode(signature);

	return `${unsignedToken}.${signatureB64}`;
}

// 메시지 암호화 (RFC 8291)
async function encryptPayload(
	payload: string,
	p256dh: string,
	auth: string
): Promise<{ ciphertext: ArrayBuffer; salt: Uint8Array; localPublicKey: ArrayBuffer }> {
	// Generate local ECDH key pair
	const localKeyPair = await crypto.subtle.generateKey(
		{ name: 'ECDH', namedCurve: 'P-256' },
		true,
		['deriveBits']
	);

	// Import subscriber's public key
	const subscriberPublicKey = await crypto.subtle.importKey(
		'raw',
		base64UrlDecode(p256dh),
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[]
	);

	// Derive shared secret
	const sharedSecret = await crypto.subtle.deriveBits(
		{ name: 'ECDH', public: subscriberPublicKey },
		localKeyPair.privateKey,
		256
	);

	// Generate salt
	const salt = crypto.getRandomValues(new Uint8Array(16));

	// Auth secret
	const authSecret = base64UrlDecode(auth);

	// Derive key material using HKDF
	const ikm = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);

	// PRK = HKDF-Extract(auth_secret, shared_secret)
	const prk = await crypto.subtle.deriveBits(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: authSecret,
			info: new TextEncoder().encode('Content-Encoding: auth\0')
		},
		ikm,
		256
	);

	// IKM for content encryption
	const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);

	// Derive CEK and nonce
	const keyInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
	const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');

	const cek = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt, info: keyInfo },
		prkKey,
		128
	);

	const nonce = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
		prkKey,
		96
	);

	// Encrypt payload
	const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);

	// Add padding
	const payloadBytes = new TextEncoder().encode(payload);
	const paddedPayload = new Uint8Array(payloadBytes.length + 2);
	paddedPayload[0] = 0; // Padding delimiter
	paddedPayload[1] = 0; // Padding length (0 for simplicity)
	paddedPayload.set(payloadBytes, 2);

	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: nonce },
		cekKey,
		paddedPayload
	);

	const localPublicKey = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);

	return { ciphertext, salt, localPublicKey };
}

// Web Push 발송
export async function sendWebPush(
	subscription: PushSubscription,
	payload: PushPayload,
	vapidPublicKey: string,
	vapidPrivateKey: string,
	vapidSubject: string
): Promise<{ success: boolean; status?: number; error?: string }> {
	try {
		const url = new URL(subscription.endpoint);
		const audience = `${url.protocol}//${url.host}`;
		const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12시간

		// VAPID JWT 생성
		const jwt = await createVapidJwt(
			audience,
			vapidSubject,
			vapidPublicKey,
			vapidPrivateKey,
			expiration
		);

		// 메시지 암호화
		const payloadJson = JSON.stringify(payload);
		const { ciphertext, salt, localPublicKey } = await encryptPayload(
			payloadJson,
			subscription.p256dh,
			subscription.auth
		);

		// aes128gcm 형식의 body 생성
		const recordSize = 4096;
		const header = new Uint8Array(21 + 65); // salt(16) + rs(4) + idlen(1) + keyid(65)
		header.set(salt, 0);
		new DataView(header.buffer).setUint32(16, recordSize, false);
		header[20] = 65; // keyid length
		header.set(new Uint8Array(localPublicKey), 21);

		const body = new Uint8Array(header.length + ciphertext.byteLength);
		body.set(header, 0);
		body.set(new Uint8Array(ciphertext), header.length);

		// Push 요청
		const response = await fetch(subscription.endpoint, {
			method: 'POST',
			headers: {
				Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
				'Content-Type': 'application/octet-stream',
				'Content-Encoding': 'aes128gcm',
				TTL: '86400'
			},
			body
		});

		if (response.status === 201) {
			return { success: true, status: 201 };
		} else if (response.status === 410) {
			// Subscription expired
			return { success: false, status: 410, error: 'Subscription expired' };
		} else {
			const errorText = await response.text();
			return { success: false, status: response.status, error: errorText };
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

// 현재 시간에 알림을 보내야 하는 구독자 조회 및 발송
export async function sendScheduledPushNotifications(
	db: D1Database,
	vapidPublicKey: string,
	vapidPrivateKey: string,
	vapidSubject: string
): Promise<{ sent: number; failed: number; expired: number }> {
	const now = new Date();
	const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	const currentDay = now.getDay();
	const currentTimestamp = Math.floor(Date.now() / 1000);

	// 현재 시간에 알림이 필요한 구독자 조회
	const subscriptions = await db
		.prepare(
			`
		SELECT ps.*, u.sync_code
		FROM push_subscriptions ps
		JOIN users u ON ps.user_id = u.id
		WHERE ps.alarm_time = ?
		AND (ps.last_sent_at IS NULL OR ps.last_sent_at < ?)
	`
		)
		.bind(currentTime, currentTimestamp - 60)
		.all();

	let sent = 0;
	let failed = 0;
	let expired = 0;

	for (const sub of subscriptions.results) {
		// 오늘이 알림 요일인지 확인
		const notifyDays = JSON.parse((sub.notify_days as string) || '[0,1,2,3,4,5,6]');
		if (!notifyDays.includes(currentDay)) {
			continue;
		}

		// 해당 사용자의 오늘 알림이 있는 메모 조회
		const memos = await db
			.prepare(
				`
			SELECT * FROM memos
			WHERE user_id = ?
			AND deleted_at IS NULL
			AND reminder IS NOT NULL
			LIMIT 5
		`
			)
			.bind(sub.user_id)
			.all();

		if (memos.results.length === 0) {
			continue;
		}

		// Push 발송
		const result = await sendWebPush(
			{
				endpoint: sub.endpoint as string,
				p256dh: sub.p256dh as string,
				auth: sub.auth as string
			},
			{
				title: '메모 알람',
				body: `${memos.results.length}개의 알림이 있습니다`,
				tag: 'memo-reminder',
				url: '/'
			},
			vapidPublicKey,
			vapidPrivateKey,
			vapidSubject
		);

		if (result.success) {
			sent++;
			// 마지막 발송 시간 업데이트
			await db
				.prepare('UPDATE push_subscriptions SET last_sent_at = ? WHERE id = ?')
				.bind(currentTimestamp, sub.id)
				.run();
		} else if (result.status === 410) {
			expired++;
			// 만료된 구독 삭제
			await db.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run();
		} else {
			failed++;
			console.error(`Push failed for ${sub.endpoint}: ${result.error}`);
		}
	}

	return { sent, failed, expired };
}
