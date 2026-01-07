import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { SyncMemo, SyncFolder, SyncResponse } from '$lib/types/sync';

// 동기화 코드 생성 (6자리 영숫자)
function generateSyncCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let code = '';
	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

// UUID 생성
function generateId(): string {
	return crypto.randomUUID();
}

// POST: 동기화 (push/pull 통합)
export const POST: RequestHandler = async ({ request, platform }) => {
	const db = platform?.env?.DB;
	if (!db) {
		return json({ success: false, error: 'Database not available' } as SyncResponse, { status: 503 });
	}

	try {
		const body = await request.json();
		const { action, syncCode, deviceName, localData } = body;

		if (action === 'register') {
			// 새 사용자 등록
			const userId = generateId();
			const newSyncCode = generateSyncCode();
			const now = Math.floor(Date.now() / 1000);

			await db.prepare(
				'INSERT INTO users (id, sync_code, device_name, created_at) VALUES (?, ?, ?, ?)'
			).bind(userId, newSyncCode, deviceName || 'Unknown Device', now).run();

			return json({
				success: true,
				user: {
					id: userId,
					syncCode: newSyncCode,
					deviceName: deviceName || 'Unknown Device',
					createdAt: now * 1000
				}
			} as SyncResponse);
		}

		if (!syncCode) {
			return json({ success: false, error: 'Sync code is required' } as SyncResponse, { status: 400 });
		}

		// 사용자 찾기
		const user = await db.prepare(
			'SELECT * FROM users WHERE sync_code = ?'
		).bind(syncCode.toUpperCase()).first();

		if (action === 'connect') {
			if (!user) {
				return json({ success: false, error: 'Invalid sync code' } as SyncResponse, { status: 404 });
			}

			return json({
				success: true,
				user: {
					id: user.id as string,
					syncCode: user.sync_code as string,
					deviceName: user.device_name as string,
					createdAt: (user.created_at as number) * 1000,
					lastSyncAt: user.last_sync_at ? (user.last_sync_at as number) * 1000 : undefined
				}
			} as SyncResponse);
		}

		if (!user) {
			return json({ success: false, error: 'User not found' } as SyncResponse, { status: 404 });
		}

		const userId = user.id as string;
		const now = Math.floor(Date.now() / 1000);

		if (action === 'push') {
			// 로컬 데이터를 서버로 푸시
			const { memos, folders } = localData || { memos: [], folders: [] };

			// 메모 업서트
			for (const memo of (memos as SyncMemo[])) {
				const existing = await db.prepare('SELECT id FROM memos WHERE id = ?').bind(memo.id).first();

				if (existing) {
					await db.prepare(`
						UPDATE memos SET
							title = ?, content = ?, url = ?, emoji = ?, tags = ?,
							is_pinned = ?, is_favorite = ?, open_count = ?, folder_id = ?,
							checklist = ?, reminder = ?, updated_at = ?, deleted_at = ?
						WHERE id = ? AND user_id = ?
					`).bind(
						memo.title,
						memo.content,
						memo.url || null,
						memo.emoji || null,
						JSON.stringify(memo.tags || []),
						memo.isPinned ? 1 : 0,
						memo.isFavorite ? 1 : 0,
						memo.openCount || 0,
						memo.folderId || null,
						memo.checklist || null,
						memo.reminder || null,
						Math.floor(memo.updatedAt / 1000),
						memo.deletedAt ? Math.floor(memo.deletedAt / 1000) : null,
						memo.id,
						userId
					).run();
				} else {
					await db.prepare(`
						INSERT INTO memos (id, user_id, title, content, url, emoji, tags,
							is_pinned, is_favorite, open_count, folder_id, checklist, reminder,
							created_at, updated_at, deleted_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`).bind(
						memo.id,
						userId,
						memo.title,
						memo.content,
						memo.url || null,
						memo.emoji || null,
						JSON.stringify(memo.tags || []),
						memo.isPinned ? 1 : 0,
						memo.isFavorite ? 1 : 0,
						memo.openCount || 0,
						memo.folderId || null,
						memo.checklist || null,
						memo.reminder || null,
						Math.floor(memo.createdAt / 1000),
						Math.floor(memo.updatedAt / 1000),
						memo.deletedAt ? Math.floor(memo.deletedAt / 1000) : null
					).run();
				}
			}

			// 폴더 업서트
			for (const folder of (folders as SyncFolder[])) {
				const existing = await db.prepare('SELECT id FROM folders WHERE id = ?').bind(folder.id).first();

				if (existing) {
					await db.prepare(`
						UPDATE folders SET name = ?, color = ?, sort_order = ?, updated_at = ?, deleted_at = ?
						WHERE id = ? AND user_id = ?
					`).bind(
						folder.name,
						folder.color,
						folder.sortOrder,
						Math.floor(folder.updatedAt / 1000),
						folder.deletedAt ? Math.floor(folder.deletedAt / 1000) : null,
						folder.id,
						userId
					).run();
				} else {
					await db.prepare(`
						INSERT INTO folders (id, user_id, name, color, sort_order, created_at, updated_at, deleted_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?)
					`).bind(
						folder.id,
						userId,
						folder.name,
						folder.color,
						folder.sortOrder,
						Math.floor(folder.createdAt / 1000),
						Math.floor(folder.updatedAt / 1000),
						folder.deletedAt ? Math.floor(folder.deletedAt / 1000) : null
					).run();
				}
			}

			// 마지막 동기화 시간 업데이트
			await db.prepare('UPDATE users SET last_sync_at = ? WHERE id = ?').bind(now, userId).run();

			return json({ success: true, lastSyncAt: now * 1000 } as SyncResponse);
		}

		if (action === 'pull') {
			// 서버 데이터를 클라이언트로 풀
			const lastSyncAt = localData?.lastSyncAt ? Math.floor(localData.lastSyncAt / 1000) : 0;

			const memos = await db.prepare(`
				SELECT * FROM memos WHERE user_id = ? AND updated_at > ?
			`).bind(userId, lastSyncAt).all();

			const folders = await db.prepare(`
				SELECT * FROM folders WHERE user_id = ? AND updated_at > ?
			`).bind(userId, lastSyncAt).all();

			// 마지막 동기화 시간 업데이트
			await db.prepare('UPDATE users SET last_sync_at = ? WHERE id = ?').bind(now, userId).run();

			return json({
				success: true,
				data: {
					memos: memos.results.map((m) => ({
						id: m.id,
						userId: m.user_id,
						title: m.title,
						content: m.content,
						url: m.url,
						emoji: m.emoji,
						tags: JSON.parse((m.tags as string) || '[]'),
						isPinned: m.is_pinned === 1,
						isFavorite: m.is_favorite === 1,
						openCount: m.open_count || 0,
						folderId: m.folder_id,
						checklist: m.checklist,
						reminder: m.reminder,
						createdAt: (m.created_at as number) * 1000,
						updatedAt: (m.updated_at as number) * 1000,
						deletedAt: m.deleted_at ? (m.deleted_at as number) * 1000 : undefined
					})),
					folders: folders.results.map((f) => ({
						id: f.id,
						userId: f.user_id,
						name: f.name,
						color: f.color,
						sortOrder: f.sort_order || 0,
						createdAt: (f.created_at as number) * 1000,
						updatedAt: (f.updated_at as number) * 1000,
						deletedAt: f.deleted_at ? (f.deleted_at as number) * 1000 : undefined
					})),
					lastSyncAt: now * 1000
				}
			} as SyncResponse);
		}

		return json({ success: false, error: 'Invalid action' } as SyncResponse, { status: 400 });
	} catch (error) {
		console.error('Sync error:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Sync failed'
		} as SyncResponse, { status: 500 });
	}
};
