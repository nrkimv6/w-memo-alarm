import { browser } from '$app/environment';

const STORAGE_KEY = 'memo-alarm-onboarding';

interface OnboardingState {
	hasSeenSwipeGuide: boolean;
}

const defaultState: OnboardingState = {
	hasSeenSwipeGuide: false
};

function loadState(): OnboardingState {
	if (!browser) return defaultState;
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return stored ? { ...defaultState, ...JSON.parse(stored) } : defaultState;
	} catch {
		return defaultState;
	}
}

function saveState(state: OnboardingState) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		console.error('Failed to save onboarding state:', e);
	}
}

class OnboardingStore {
	private state = $state<OnboardingState>(loadState());

	get hasSeenSwipeGuide() {
		return this.state.hasSeenSwipeGuide;
	}

	markSwipeGuideSeen() {
		this.state.hasSeenSwipeGuide = true;
		saveState(this.state);
	}

	reset() {
		this.state = { ...defaultState };
		saveState(this.state);
	}
}

export const onboardingStore = new OnboardingStore();
