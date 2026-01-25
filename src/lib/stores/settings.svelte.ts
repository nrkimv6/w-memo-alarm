const STORAGE_KEY = 'memo-alarm-settings';

export interface DefaultReminderSettings {
	enabled: boolean;
	time: string;
	days: number[];
	autoOpen: boolean;
}

export interface AppSettings {
	defaultReminder: DefaultReminderSettings;
	autoReminderOnCreate: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
	defaultReminder: {
		enabled: true,
		time: '09:00',
		days: [1, 2, 3, 4, 5], // 월-금
		autoOpen: false
	},
	autoReminderOnCreate: false
};

function loadFromStorage(): AppSettings {
	if (typeof window === 'undefined') return DEFAULT_SETTINGS;
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (data) {
			const parsed = JSON.parse(data);
			return { ...DEFAULT_SETTINGS, ...parsed };
		}
		return DEFAULT_SETTINGS;
	} catch {
		return DEFAULT_SETTINGS;
	}
}

function saveToStorage(settings: AppSettings): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch (e) {
		console.error('Failed to save settings:', e);
	}
}

function createSettingsStore() {
	let settings = $state<AppSettings>(DEFAULT_SETTINGS);
	let initialized = $state(false);

	function init() {
		if (initialized) return;
		settings = loadFromStorage();
		initialized = true;
	}

	async function setDefaultReminderTime(time: string) {
		const oldTime = settings.defaultReminder.time;
		settings = {
			...settings,
			defaultReminder: { ...settings.defaultReminder, time }
		};
		saveToStorage(settings);

		// 기본알림을 사용하는 메모들 일괄 업데이트
		if (typeof window !== 'undefined' && oldTime !== time) {
			const { memosStore } = await import('./memos.svelte');
			await memosStore.updateDefaultReminderMemos(
				settings.defaultReminder.time,
				settings.defaultReminder.days,
				settings.defaultReminder.autoOpen
			);
		}
	}

	async function setDefaultReminderDays(days: number[]) {
		const oldDays = settings.defaultReminder.days;
		settings = {
			...settings,
			defaultReminder: { ...settings.defaultReminder, days }
		};
		saveToStorage(settings);

		// 기본알림을 사용하는 메모들 일괄 업데이트
		if (typeof window !== 'undefined' && JSON.stringify(oldDays) !== JSON.stringify(days)) {
			const { memosStore } = await import('./memos.svelte');
			await memosStore.updateDefaultReminderMemos(
				settings.defaultReminder.time,
				settings.defaultReminder.days,
				settings.defaultReminder.autoOpen
			);
		}
	}

	function setAutoReminderOnCreate(enabled: boolean) {
		settings = { ...settings, autoReminderOnCreate: enabled };
		saveToStorage(settings);
	}

	async function setDefaultReminderAutoOpen(autoOpen: boolean) {
		const oldAutoOpen = settings.defaultReminder.autoOpen;
		settings = {
			...settings,
			defaultReminder: { ...settings.defaultReminder, autoOpen }
		};
		saveToStorage(settings);

		// 기본알림을 사용하는 메모들 일괄 업데이트
		if (typeof window !== 'undefined' && oldAutoOpen !== autoOpen) {
			const { memosStore } = await import('./memos.svelte');
			await memosStore.updateDefaultReminderMemos(
				settings.defaultReminder.time,
				settings.defaultReminder.days,
				settings.defaultReminder.autoOpen
			);
		}
	}

	function getDefaultReminder(): DefaultReminderSettings {
		return settings.defaultReminder;
	}

	return {
		get settings() {
			return settings;
		},
		get initialized() {
			return initialized;
		},
		init,
		setDefaultReminderTime,
		setDefaultReminderDays,
		setAutoReminderOnCreate,
		setDefaultReminderAutoOpen,
		getDefaultReminder
	};
}

export const settingsStore = createSettingsStore();
