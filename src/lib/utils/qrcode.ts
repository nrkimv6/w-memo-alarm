import QRCode from 'qrcode';
import type { Memo } from '$lib/types/memo';
import { formatMemoForShare } from './share';

export async function generateQRCode(data: string, size = 256): Promise<string> {
	try {
		return await QRCode.toDataURL(data, {
			width: size,
			margin: 2,
			color: {
				dark: '#000000',
				light: '#FFFFFF'
			}
		});
	} catch (err) {
		console.error('QR code generation failed:', err);
		throw err;
	}
}

export function getMemoShareText(memo: Memo): string {
	const shareData = formatMemoForShare(memo);
	let text = shareData.title;
	if (memo.content) {
		text += `\n\n${memo.content}`;
	}
	if (memo.tags.length > 0) {
		text += `\n\n#${memo.tags.join(' #')}`;
	}
	if (memo.url) {
		text += `\n\n${memo.url}`;
	}
	return text;
}

export async function generateMemoQRCode(memo: Memo, size = 256): Promise<string> {
	const text = getMemoShareText(memo);
	return generateQRCode(text, size);
}
