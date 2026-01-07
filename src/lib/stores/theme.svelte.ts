type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'memo-alarm-theme';

function getSystemTheme(): 'light' | 'dark' {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function createThemeStore() {
	let theme = $state<Theme>('system');
	let resolved = $state<'light' | 'dark'>('light');
	let initialized = $state(false);

	function init() {
		if (initialized || typeof window === 'undefined') return;

		// Load saved theme
		const saved = localStorage.getItem(THEME_KEY) as Theme | null;
		if (saved && ['light', 'dark', 'system'].includes(saved)) {
			theme = saved;
		}

		// Resolve initial theme
		resolved = theme === 'system' ? getSystemTheme() : theme;
		applyTheme();

		// Listen for system theme changes
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
			if (theme === 'system') {
				resolved = e.matches ? 'dark' : 'light';
				applyTheme();
			}
		});

		initialized = true;
	}

	function setTheme(newTheme: Theme) {
		theme = newTheme;
		resolved = newTheme === 'system' ? getSystemTheme() : newTheme;

		if (typeof window !== 'undefined') {
			localStorage.setItem(THEME_KEY, newTheme);
		}

		applyTheme();
	}

	function toggle() {
		const next = resolved === 'dark' ? 'light' : 'dark';
		setTheme(next);
	}

	function applyTheme() {
		if (typeof document === 'undefined') return;

		if (resolved === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}

	return {
		get theme() {
			return theme;
		},
		get resolved() {
			return resolved;
		},
		get isDark() {
			return resolved === 'dark';
		},
		init,
		setTheme,
		toggle
	};
}

export const themeStore = createThemeStore();
