import { browser } from '$app/environment';

type NetworkCallback = (isOnline: boolean) => void;

class NetworkStatus {
	private callbacks: NetworkCallback[] = [];
	private _isOnline = true;

	constructor() {
		if (browser) {
			this._isOnline = navigator.onLine;

			window.addEventListener('online', () => {
				this._isOnline = true;
				console.log('[Network] Online');
				this.notifyCallbacks(true);
			});

			window.addEventListener('offline', () => {
				this._isOnline = false;
				console.log('[Network] Offline');
				this.notifyCallbacks(false);
			});
		}
	}

	get isOnline(): boolean {
		return this._isOnline;
	}

	onStatusChange(callback: NetworkCallback): () => void {
		this.callbacks.push(callback);
		return () => {
			this.callbacks = this.callbacks.filter((cb) => cb !== callback);
		};
	}

	private notifyCallbacks(isOnline: boolean) {
		this.callbacks.forEach((cb) => cb(isOnline));
	}
}

export const networkStatus = new NetworkStatus();
