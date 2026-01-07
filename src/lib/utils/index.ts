import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function generateId(): string {
	return crypto.randomUUID();
}

export function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		return days === 1 ? '어제' : `${days}일 전`;
	}
	if (hours > 0) {
		return `${hours}시간 전`;
	}
	if (minutes > 0) {
		return `${minutes}분 전`;
	}
	return '방금 전';
}

export function formatAlarmTime(date: Date): string {
	return date.toLocaleTimeString('ko-KR', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
}

export function formatAlarmDate(date: Date): string {
	const today = new Date();
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);

	if (isSameDay(date, today)) {
		return '오늘';
	}
	if (isSameDay(date, tomorrow)) {
		return '내일';
	}
	return date.toLocaleDateString('ko-KR', {
		month: 'short',
		day: 'numeric'
	});
}

function isSameDay(d1: Date, d2: Date): boolean {
	return (
		d1.getFullYear() === d2.getFullYear() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getDate() === d2.getDate()
	);
}

export function getDomain(url: string): string {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname.replace('www.', '');
	} catch {
		return url;
	}
}

export function truncate(str: string, length: number): string {
	if (str.length <= length) return str;
	return str.slice(0, length) + '...';
}

export * from './share';
