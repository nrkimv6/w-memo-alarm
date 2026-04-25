import { rm, access, rename } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetDir = resolve(__dirname, '..', '.svelte-kit', 'cloudflare');

async function exists(path) {
	try {
		await access(path, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

async function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

/** 백그라운드 삭제: detach해서 빌드를 블로킹하지 않음 */
function deleteInBackground(path) {
	const winPath = path.replaceAll('/', '\\');
	const child = spawn('cmd', ['/c', 'rmdir', '/s', '/q', winPath], {
		detached: true,
		stdio: 'ignore'
	});
	child.unref();
}

/** old 잔여물 정리 (이전 실행이 남긴 __old_* 디렉토리) */
async function cleanupOldBackups() {
	const parentDir = resolve(targetDir, '..');
	const { readdir, stat } = await import('node:fs/promises');
	try {
		const entries = await readdir(parentDir);
		for (const entry of entries) {
			if (entry.startsWith('cloudflare__old_')) {
				deleteInBackground(resolve(parentDir, entry));
			}
		}
	} catch {
		// 무시
	}
}

if (!(await exists(targetDir))) {
	console.log('[clean] .svelte-kit/cloudflare not found — skipping.');
	process.exit(0);
}

// 이전 백업 잔여물 먼저 정리
await cleanupOldBackups();

console.log('[clean] renaming .svelte-kit/cloudflare → backup for background deletion...');
const backupDir = targetDir + '__old_' + Date.now();

try {
	// rename은 AV가 파일을 스캔 중이어도 대부분 성공 (Windows atomic move)
	await rename(targetDir, backupDir);
	console.log('[clean] rename 완료 — 백그라운드 삭제 시작.');
	deleteInBackground(backupDir);
} catch (renameErr) {
	// rename 실패 시 일반 rm retry 로직으로 폴백
	console.warn(`[clean] rename 실패(${renameErr.code}) — rm retry 폴백...`);
	const { execSync } = await import('node:child_process');
	for (let attempt = 1; attempt <= 5; attempt++) {
		try {
			await rm(targetDir, { recursive: true, force: true });
			console.log('[clean] rm 성공.');
			break;
		} catch (err) {
			if ((err.code === 'EPERM' || err.code === 'EBUSY') && attempt < 5) {
				console.warn(`[clean] rm attempt ${attempt}/5: ${err.code} — retrying in ${attempt * 500}ms...`);
				await sleep(attempt * 500);
			} else if (err.code === 'EPERM' || err.code === 'EBUSY') {
				console.warn(`[clean] rm 5회 실패 — cmd rmdir 폴백 (3s wait)...`);
				await sleep(3000);
				try {
					execSync(`cmd /c rmdir /s /q "${targetDir.replaceAll('/', '\\')}"`, { stdio: 'pipe' });
					console.log('[clean] cmd rmdir 성공.');
				} catch {
					console.warn('[clean] cmd rmdir도 실패 — 삭제 건너뜀 (adapter rimraf에 위임).');
				}
				break;
			} else {
				throw err;
			}
		}
	}
}

console.log('[clean] done.');
