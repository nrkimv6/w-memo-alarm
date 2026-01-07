import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function generateId(): string {
	return crypto.randomUUID();
}

export function formatRelativeTime(date: Date | number): string {
	const d = typeof date === 'number' ? new Date(date) : date;
	return formatDistanceToNow(d, { addSuffix: true, locale: ko });
}

export function formatSmartDate(date: Date | number): string {
	const d = typeof date === 'number' ? new Date(date) : date;
	if (isToday(d)) {
		return `오늘 ${format(d, 'HH:mm')}`;
	}
	if (isYesterday(d)) {
		return `어제 ${format(d, 'HH:mm')}`;
	}
	return format(d, 'M월 d일 HH:mm', { locale: ko });
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
