import type { RealtimeChannel } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { authStore } from './auth.svelte';
import { supabase } from '$lib/services/supabase';

const STORAGE_KEY = 'memo-alarm-settings';
const ACCOUNT_SETTINGS_TABLE = 'ma_user_settings';

export interface DefaultReminderSettings {
	enabled: boolean;
	time: string;
	days: number[];
	autoOpen: boolean;
}

export interface TodoDefaultSettings {
	remind: {
		enabled: boolean;
		time: string; // HH:mm
	};
	autoAlert: {
		enabled: boolean;
		minutesBefore: number; // 기한 전 N분
	};
	showOverdue: boolean;
	showProgress: boolean;
	showUpcomingOnEmpty: boolean; // 빈 화면에 다가오는 할일 표시
}

export interface AppSettings {
	defaultReminder: DefaultReminderSettings;
	autoReminderOnCreate: boolean;
	todoDefaults: TodoDefaultSettings;
	useMarkdown: boolean; // 마크다운 렌더링 활성화
}

interface AccountSettingsPayload {
	defaultReminder: DefaultReminderSettings;
	autoReminderOnCreate: boolean;
	todoDefaults: {
		remind: {
			enabled: boolean;
			time: string;
		};
		autoAlert: {
			enabled: boolean;
			minutesBefore: number;
		};
	};
}

interface UserSettingsRow {
	user_id: string;
	notification_defaults: AccountSettingsPayload | null;
	updated_at?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
	defaultReminder: {
		enabled: true,
		time: '09:00',
		days: [1, 2, 3, 4, 5],
		autoOpen: false
	},
	autoReminderOnCreate: false,
	useMarkdown: false,
	todoDefaults: {
		remind: {
			enabled: true,
			time: '07:00'
		},
		autoAlert: {
			enabled: false,
			minutesBefore: 60
		},
		showOverdue: true,
		showProgress: true,
		showUpcomingOnEmpty: true
	}
};

function normalizeSettings(input?: Partial<AppSettings> | null): AppSettings {
	return {
		defaultReminder: {
			...DEFAULT_SETTINGS.defaultReminder,
			...(input?.defaultReminder ?? {})
		},
		autoReminderOnCreate: input?.autoReminderOnCreate ?? DEFAULT_SETTINGS.autoReminderOnCreate,
		todoDefaults: {
			remind: {
				...DEFAULT_SETTINGS.todoDefaults.remind,
				...(input?.todoDefaults?.remind ?? {})
			},
			autoAlert: {
				...DEFAULT_SETTINGS.todoDefaults.autoAlert,
				...(input?.todoDefaults?.autoAlert ?? {})
			},
			showOverdue: input?.todoDefaults?.showOverdue ?? DEFAULT_SETTINGS.todoDefaults.showOverdue,
			showProgress: input?.todoDefaults?.showProgress ?? DEFAULT_SETTINGS.todoDefaults.showProgress,
			showUpcomingOnEmpty: input?.todoDefaults?.showUpcomingOnEmpty ?? DEFAULT_SETTINGS.todoDefaults.showUpcomingOnEmpty
		},
		useMarkdown: input?.useMarkdown ?? DEFAULT_SETTINGS.useMarkdown
	};
}

function extractAccountSettings(source: AppSettings): AccountSettingsPayload {
	return {
		defaultReminder: { ...source.defaultReminder },
		autoReminderOnCreate: source.autoReminderOnCreate,
		todoDefaults: {
			remind: { ...source.todoDefaults.remind },
			autoAlert: { ...source.todoDefaults.autoAlert }
		}
	};
}

function normalizeAccountSettings(input?: Partial<AccountSettingsPayload> | null): AccountSettingsPayload {
	const defaults = extractAccountSettings(DEFAULT_SETTINGS);
	return {
		defaultReminder: {
			...defaults.defaultReminder,
			...(input?.defaultReminder ?? {})
		},
		autoReminderOnCreate: input?.autoReminderOnCreate ?? defaults.autoReminderOnCreate,
		todoDefaults: {
			remind: {
				...defaults.todoDefaults.remind,
				...(input?.todoDefaults?.remind ?? {})
			},
			autoAlert: {
				...defaults.todoDefaults.autoAlert,
				...(input?.todoDefaults?.autoAlert ?? {})
			}
		}
	};
}

function mergeAccountSettings(localSettings: AppSettings, accountSettings: AccountSettingsPayload): AppSettings {
	return normalizeSettings({
		...localSettings,
		defaultReminder: accountSettings.defaultReminder,
		autoReminderOnCreate: accountSettings.autoReminderOnCreate,
		todoDefaults: {
			...localSettings.todoDefaults,
			remind: accountSettings.todoDefaults.remind,
			autoAlert: accountSettings.todoDefaults.autoAlert
		}
	});
}

function loadFromStorage(): AppSettings {
	if (!browser) return DEFAULT_SETTINGS;
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (!data) return DEFAULT_SETTINGS;
		return normalizeSettings(JSON.parse(data) as Partial<AppSettings>);
	} catch {
		return DEFAULT_SETTINGS;
	}
}

function saveToStorage(nextSettings: AppSettings): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
	} catch (e) {
		console.error('Failed to save settings:', e);
	}
}

function serializeAccountSettings(accountSettings: AccountSettingsPayload): string {
	return JSON.stringify(normalizeAccountSettings(accountSettings));
}

function createSettingsStore() {
	let settings = $state<AppSettings>(DEFAULT_SETTINGS);
	let initialized = $state(false);
	let initializingPromise: Promise<void> | null = null;
	let subscription: RealtimeChannel | null = null;
	let lastKnownRemoteSignature = '';
	let pendingRuntimeSync = $state({ remind: false, autoAlert: false });

	function setSettings(nextSettings: AppSettings) {
		settings = normalizeSettings(nextSettings);
		saveToStorage(settings);
	}

	function queueRuntimeSync(prevSettings: AppSettings, nextSettings: AppSettings) {
		if (prevSettings.todoDefaults.remind.time !== nextSettings.todoDefaults.remind.time) {
			pendingRuntimeSync = { ...pendingRuntimeSync, remind: true };
		}
		if (prevSettings.todoDefaults.autoAlert.minutesBefore !== nextSettings.todoDefaults.autoAlert.minutesBefore) {
			pendingRuntimeSync = { ...pendingRuntimeSync, autoAlert: true };
		}
	}

	async function flushPendingRuntimeSync() {
		if (!browser || (!pendingRuntimeSync.remind && !pendingRuntimeSync.autoAlert)) return;
		const { memosStore } = await import('./memos.svelte');
		if (!memosStore.initialized) return;

		const run = pendingRuntimeSync;
		pendingRuntimeSync = { remind: false, autoAlert: false };

		if (run.remind) {
			await memosStore.updateGlobalRemindTodos(settings.todoDefaults.remind.time);
		}
		if (run.autoAlert) {
			await memosStore.updateGlobalAutoAlertTodos(settings.todoDefaults.autoAlert.minutesBefore);
		}
	}

	function applyAccountSettings(accountSettings: AccountSettingsPayload, options?: { syncRuntime?: boolean }) {
		const normalizedAccountSettings = normalizeAccountSettings(accountSettings);
		const prevSettings = settings;
		const nextSettings = mergeAccountSettings(settings, normalizedAccountSettings);
		const prevSignature = serializeAccountSettings(extractAccountSettings(prevSettings));
		const nextSignature = serializeAccountSettings(normalizedAccountSettings);

		lastKnownRemoteSignature = nextSignature;
		if (prevSignature === nextSignature) {
			setSettings(nextSettings);
			return;
		}

		setSettings(nextSettings);
		if (options?.syncRuntime) {
			queueRuntimeSync(prevSettings, nextSettings);
			void flushPendingRuntimeSync();
		}
	}

	async function upsertAccountSettings(options?: { silent?: boolean }) {
		if (!browser || !authStore.isAuthenticated || !authStore.user) return;
		const accountSettings = extractAccountSettings(settings);
		lastKnownRemoteSignature = serializeAccountSettings(accountSettings);

		const { error } = await supabase.from(ACCOUNT_SETTINGS_TABLE).upsert(
			{
				user_id: authStore.user.id,
				notification_defaults: accountSettings
			},
			{ onConflict: 'user_id' }
		);

		if (error) {
			console.error('Failed to upsert account settings:', error);
			if (!options?.silent) {
				console.error('Account settings sync failed for user action');
			}
		}
	}

	async function fetchFromSupabase() {
		if (!authStore.user) return;
		const localSettings = loadFromStorage();
		setSettings(localSettings);

		const { data, error } = await supabase
			.from(ACCOUNT_SETTINGS_TABLE)
			.select('user_id, notification_defaults, updated_at')
			.eq('user_id', authStore.user.id)
			.maybeSingle();

		if (error) {
			console.error('Failed to load account settings:', error);
			return;
		}

		const row = data as UserSettingsRow | null;
		if (!row?.notification_defaults) {
			await upsertAccountSettings({ silent: true });
			return;
		}

		applyAccountSettings(row.notification_defaults, { syncRuntime: true });
	}

	function subscribeToRealtime() {
		if (!authStore.user) return;
		subscription?.unsubscribe();
		subscription = supabase
			.channel(`user-settings:${authStore.user.id}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: ACCOUNT_SETTINGS_TABLE,
					filter: `user_id=eq.${authStore.user.id}`
				},
				(payload) => {
					if (payload.eventType === 'DELETE') return;
					const row = payload.new as UserSettingsRow;
					if (!row.notification_defaults) return;

					const nextSignature = serializeAccountSettings(row.notification_defaults);
					if (nextSignature === lastKnownRemoteSignature) {
						setSettings(mergeAccountSettings(settings, normalizeAccountSettings(row.notification_defaults)));
						return;
					}

					applyAccountSettings(row.notification_defaults, { syncRuntime: true });
				}
			)
			.subscribe();
	}

	async function init() {
		if (initialized) return;
		if (initializingPromise) {
			await initializingPromise;
			return;
		}

		initializingPromise = (async () => {
			setSettings(loadFromStorage());
			if (browser && authStore.isAuthenticated && authStore.user) {
				await fetchFromSupabase();
				subscribeToRealtime();
			}
			initialized = true;
		})();

		try {
			await initializingPromise;
		} finally {
			initializingPromise = null;
		}
	}

	async function reinit() {
		subscription?.unsubscribe();
		subscription = null;
		initialized = false;
		lastKnownRemoteSignature = '';
		await init();
	}

	function cleanup() {
		subscription?.unsubscribe();
		subscription = null;
		settings = loadFromStorage();
		lastKnownRemoteSignature = '';
		pendingRuntimeSync = { remind: false, autoAlert: false };
		initialized = false;
	}

	async function setDefaultReminderTime(time: string) {
		const oldTime = settings.defaultReminder.time;
		const prevSettings = settings;
		const nextSettings = normalizeSettings({
			...settings,
			defaultReminder: { ...settings.defaultReminder, time }
		});
		setSettings(nextSettings);
		await upsertAccountSettings({ silent: false });

		if (browser && oldTime !== time) {
			const { memosStore } = await import('./memos.svelte');
			await memosStore.updateDefaultReminderMemos(
				nextSettings.defaultReminder.time,
				nextSettings.defaultReminder.days,
				nextSettings.defaultReminder.autoOpen
			);
		}
		queueRuntimeSync(prevSettings, nextSettings);
		await flushPendingRuntimeSync();
	}

	async function setDefaultReminderDays(days: number[]) {
		const oldDays = settings.defaultReminder.days;
		const nextSettings = normalizeSettings({
			...settings,
			defaultReminder: { ...settings.defaultReminder, days }
		});
		setSettings(nextSettings);
		await upsertAccountSettings({ silent: false });

		if (browser && JSON.stringify(oldDays) !== JSON.stringify(days)) {
			const { memosStore } = await import('./memos.svelte');
			await memosStore.updateDefaultReminderMemos(
				nextSettings.defaultReminder.time,
				nextSettings.defaultReminder.days,
				nextSettings.defaultReminder.autoOpen
			);
		}
	}

	async function setAutoReminderOnCreate(enabled: boolean) {
		setSettings({
			...settings,
			autoReminderOnCreate: enabled
		});
		await upsertAccountSettings({ silent: false });
	}

	async function setDefaultReminderAutoOpen(autoOpen: boolean) {
		const oldAutoOpen = settings.defaultReminder.autoOpen;
		const nextSettings = normalizeSettings({
			...settings,
			defaultReminder: { ...settings.defaultReminder, autoOpen }
		});
		setSettings(nextSettings);
		await upsertAccountSettings({ silent: false });

		if (browser && oldAutoOpen !== autoOpen) {
			const { memosStore } = await import('./memos.svelte');
			await memosStore.updateDefaultReminderMemos(
				nextSettings.defaultReminder.time,
				nextSettings.defaultReminder.days,
				nextSettings.defaultReminder.autoOpen
			);
		}
	}

	function getDefaultReminder(): DefaultReminderSettings {
		return settings.defaultReminder;
	}

	async function setTodoRemindEnabled(enabled: boolean) {
		setSettings({
			...settings,
			todoDefaults: {
				...settings.todoDefaults,
				remind: { ...settings.todoDefaults.remind, enabled }
			}
		});
		await upsertAccountSettings({ silent: false });
	}

	async function setTodoRemindTime(time: string) {
		const oldTime = settings.todoDefaults.remind.time;
		const prevSettings = settings;
		const nextSettings = normalizeSettings({
			...settings,
			todoDefaults: {
				...settings.todoDefaults,
				remind: { ...settings.todoDefaults.remind, time }
			}
		});
		setSettings(nextSettings);
		await upsertAccountSettings({ silent: false });

		if (browser && oldTime !== time) {
			const { memosStore } = await import('./memos.svelte');
			await memosStore.updateGlobalRemindTodos(time);
		}
		queueRuntimeSync(prevSettings, nextSettings);
		await flushPendingRuntimeSync();
	}

	async function setTodoAutoAlertEnabled(enabled: boolean) {
		setSettings({
			...settings,
			todoDefaults: {
				...settings.todoDefaults,
				autoAlert: { ...settings.todoDefaults.autoAlert, enabled }
			}
		});
		await upsertAccountSettings({ silent: false });
	}

	async function setTodoAutoAlertMinutes(minutesBefore: number) {
		const oldMinutes = settings.todoDefaults.autoAlert.minutesBefore;
		const prevSettings = settings;
		const nextSettings = normalizeSettings({
			...settings,
			todoDefaults: {
				...settings.todoDefaults,
				autoAlert: { ...settings.todoDefaults.autoAlert, minutesBefore }
			}
		});
		setSettings(nextSettings);
		await upsertAccountSettings({ silent: false });

		if (browser && oldMinutes !== minutesBefore) {
			const { memosStore } = await import('./memos.svelte');
			await memosStore.updateGlobalAutoAlertTodos(minutesBefore);
		}
		queueRuntimeSync(prevSettings, nextSettings);
		await flushPendingRuntimeSync();
	}

	function setTodoShowOverdue(showOverdue: boolean) {
		setSettings({
			...settings,
			todoDefaults: { ...settings.todoDefaults, showOverdue }
		});
	}

	function setTodoShowProgress(showProgress: boolean) {
		setSettings({
			...settings,
			todoDefaults: { ...settings.todoDefaults, showProgress }
		});
	}

	function setTodoShowUpcomingOnEmpty(showUpcomingOnEmpty: boolean) {
		setSettings({
			...settings,
			todoDefaults: { ...settings.todoDefaults, showUpcomingOnEmpty }
		});
	}

	function setUseMarkdown(useMarkdown: boolean) {
		setSettings({ ...settings, useMarkdown });
	}

	return {
		get settings() {
			return settings;
		},
		get initialized() {
			return initialized;
		},
		init,
		reinit,
		cleanup,
		flushPendingRuntimeSync,
		setDefaultReminderTime,
		setDefaultReminderDays,
		setAutoReminderOnCreate,
		setDefaultReminderAutoOpen,
		getDefaultReminder,
		setTodoRemindEnabled,
		setTodoRemindTime,
		setTodoAutoAlertEnabled,
		setTodoAutoAlertMinutes,
		setTodoShowOverdue,
		setTodoShowProgress,
		setTodoShowUpcomingOnEmpty,
		setUseMarkdown
	};
}

export const settingsStore = createSettingsStore();
