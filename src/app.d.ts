// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	const __APP_VERSION__: string;

	interface SpeechRecognition extends EventTarget {
		lang: string;
		continuous: boolean;
		interimResults: boolean;
		onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
		onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
		onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
		onend: ((this: SpeechRecognition, ev: Event) => void) | null;
		start(): void;
		stop(): void;
	}

	interface SpeechRecognitionAlternative {
		transcript: string;
		confidence: number;
	}

	interface SpeechRecognitionResult {
		readonly length: number;
		readonly isFinal: boolean;
		[index: number]: SpeechRecognitionAlternative;
	}

	interface SpeechRecognitionResultList {
		readonly length: number;
		[index: number]: SpeechRecognitionResult;
	}

	interface SpeechRecognitionEvent extends Event {
		readonly resultIndex: number;
		readonly results: SpeechRecognitionResultList;
	}

	interface SpeechRecognitionErrorEvent extends Event {
		readonly error: string;
	}

	type SpeechRecognitionConstructor = new () => SpeechRecognition;

	interface Window {
		SpeechRecognition?: SpeechRecognitionConstructor;
		webkitSpeechRecognition?: SpeechRecognitionConstructor;
	}

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
