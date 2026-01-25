// 개발자 모드 로그 저장소 (앱 내 확인용)

const MAX_LOGS = 200;
const STORAGE_KEY = 'memo-alarm:dev-logs';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface DevLog {
	timestamp: number;
	level: LogLevel;
	source: string; // 'NotificationStore', 'SW', 'Memos' 등
	message: string;
	data?: unknown;
}

function createDevLogStore() {
	let logs = $state<DevLog[]>([]);
	let enabled = $state(false);

	function loadFromStorage() {
		if (typeof window === 'undefined') return;
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				logs = JSON.parse(saved);
			}
		} catch (e) {
			console.error('Failed to load dev logs:', e);
		}
	}

	function saveToStorage() {
		if (typeof window === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
		} catch (e) {
			console.error('Failed to save dev logs:', e);
		}
	}

	function add(level: LogLevel, source: string, message: string, data?: unknown) {
		const log: DevLog = {
			timestamp: Date.now(),
			level,
			source,
			message,
			data
		};

		logs = [...logs, log].slice(-MAX_LOGS);
		saveToStorage();

		// 콘솔에도 출력
		const prefix = `[${source}]`;
		if (level === 'error') {
			console.error(prefix, message, data ?? '');
		} else if (level === 'warn') {
			console.warn(prefix, message, data ?? '');
		} else {
			console.log(prefix, message, data ?? '');
		}
	}

	function info(source: string, message: string, data?: unknown) {
		add('info', source, message, data);
	}

	function warn(source: string, message: string, data?: unknown) {
		add('warn', source, message, data);
	}

	function error(source: string, message: string, data?: unknown) {
		add('error', source, message, data);
	}

	function debug(source: string, message: string, data?: unknown) {
		add('debug', source, message, data);
	}

	function clear() {
		logs = [];
		saveToStorage();
	}

	function init() {
		loadFromStorage();
		enabled = true;
	}

	function getBySource(source: string): DevLog[] {
		return logs.filter((log) => log.source === source);
	}

	function getRecent(count: number = 50): DevLog[] {
		return logs.slice(-count);
	}

	return {
		get logs() {
			return logs;
		},
		get enabled() {
			return enabled;
		},
		init,
		add,
		info,
		warn,
		error,
		debug,
		clear,
		getBySource,
		getRecent
	};
}

export const devLogStore = createDevLogStore();

// 편의 함수: 소스별 로거 생성
export function createLogger(source: string) {
	return {
		info: (message: string, data?: unknown) => devLogStore.info(source, message, data),
		warn: (message: string, data?: unknown) => devLogStore.warn(source, message, data),
		error: (message: string, data?: unknown) => devLogStore.error(source, message, data),
		debug: (message: string, data?: unknown) => devLogStore.debug(source, message, data)
	};
}
