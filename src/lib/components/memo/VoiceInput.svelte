<script lang="ts">
	import { Mic, MicOff, Square } from 'lucide-svelte';
	import { toastStore } from '$lib/stores/toast.svelte';

	interface Props {
		onTranscript: (text: string) => void;
	}

	let { onTranscript }: Props = $props();

	let isListening = $state(false);
	let isSupported = $state(false);
	let recognition: SpeechRecognition | null = null;
	let interimText = $state('');

	// Web Speech API 지원 여부 확인
	$effect(() => {
		if (typeof window !== 'undefined') {
			const SpeechRecognition =
				(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
			isSupported = !!SpeechRecognition;
		}
	});

	function startListening() {
		if (typeof window === 'undefined') return;

		const SpeechRecognition =
			(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
		if (!SpeechRecognition) {
			toastStore.error('이 브라우저는 음성 인식을 지원하지 않습니다');
			return;
		}

		recognition = new SpeechRecognition();
		recognition.lang = 'ko-KR';
		recognition.continuous = true;
		recognition.interimResults = true;

		recognition.onstart = () => {
			isListening = true;
			interimText = '';
		};

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			let interim = '';
			let final = '';

			for (let i = event.resultIndex; i < event.results.length; i++) {
				const transcript = event.results[i][0].transcript;
				if (event.results[i].isFinal) {
					final += transcript;
				} else {
					interim += transcript;
				}
			}

			interimText = interim;
			if (final) {
				onTranscript(final);
			}
		};

		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			if (event.error === 'not-allowed') {
				toastStore.error('마이크 권한이 필요합니다');
			} else if (event.error !== 'aborted') {
				toastStore.error('음성 인식 오류가 발생했습니다');
			}
			isListening = false;
			interimText = '';
		};

		recognition.onend = () => {
			isListening = false;
			interimText = '';
		};

		recognition.start();
	}

	function stopListening() {
		if (recognition) {
			recognition.stop();
			recognition = null;
		}
		isListening = false;
		interimText = '';
	}

	function toggle() {
		if (isListening) {
			stopListening();
		} else {
			startListening();
		}
	}
</script>

{#if isSupported}
	<div class="flex flex-col gap-1">
		<button
			type="button"
			onclick={toggle}
			class={[
				'flex items-center gap-2 text-sm transition-colors',
				isListening
					? 'text-red-500 hover:text-red-600'
					: 'text-muted-foreground hover:text-foreground'
			].join(' ')}
			title={isListening ? '음성 인식 중지' : '음성으로 입력'}
		>
			{#if isListening}
				<span class="relative flex h-4 w-4">
					<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
					<Square class="relative inline-flex w-4 h-4" />
				</span>
				음성 인식 중지
			{:else}
				<Mic class="w-4 h-4" />
				음성으로 입력
			{/if}
		</button>
		{#if interimText}
			<p class="text-xs text-muted-foreground italic pl-6">{interimText}...</p>
		{/if}
	</div>
{/if}
