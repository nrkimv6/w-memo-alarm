import { browser } from '$app/environment';

type NetworkCallback = (isOnline: boolean) => void;

function createNetworkStatus() {
	let isOnline = $state(true);
	const callbacks: NetworkCallback[] = [];

	if (browser) {
		isOnline = navigator.onLine;

		window.addEventListener('online', () => {
			isOnline = true;
			console.log('[Network] Online');
			callbacks.forEach((cb) => cb(true));
		});

		window.addEventListener('offline', () => {
			isOnline = false;
			console.log('[Network] Offline');
			callbacks.forEach((cb) => cb(false));
		});
	}

	function onStatusChange(callback: NetworkCallback): () => void {
		callbacks.push(callback);
		return () => {
			const index = callbacks.indexOf(callback);
			if (index > -1) {
				callbacks.splice(index, 1);
			}
		};
	}

	return {
		get isOnline() {
			return isOnline;
		},
		onStatusChange
	};
}

export const networkStatus = createNetworkStatus();
