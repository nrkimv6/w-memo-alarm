import { rm, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function removeWithRetry(path, maxRetries = 5, delayMs = 200) {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await rm(path, { recursive: true, force: true });
			return;
		} catch (err) {
			if ((err.code === 'EPERM' || err.code === 'EBUSY') && attempt < maxRetries) {
				console.warn(`[clean] attempt ${attempt}/${maxRetries}: ${err.code} — retrying in ${delayMs * attempt}ms...`);
				await sleep(delayMs * attempt);
			} else {
				throw err;
			}
		}
	}
}

if (!(await exists(targetDir))) {
	console.log('[clean] .svelte-kit/cloudflare not found — skipping.');
	process.exit(0);
}

console.log('[clean] removing .svelte-kit/cloudflare...');
await removeWithRetry(targetDir);
console.log('[clean] done.');
