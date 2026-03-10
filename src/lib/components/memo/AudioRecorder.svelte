<script lang="ts">
	import { Mic, MicOff, Play, Pause, Trash2, Square, StopCircle } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		audioUrls: string[];
		onAudioChange: (audios: string[]) => void;
		readonly?: boolean;
	}

	let { audioUrls, onAudioChange, readonly = false }: Props = $props();

	// 녹음 상태
	let isRecording = $state(false);
	let mediaRecorder = $state<MediaRecorder | null>(null);
	let audioChunks = $state<Blob[]>([]);
	let recordingDuration = $state(0);
	let recordingTimer: ReturnType<typeof setInterval> | null = null;
	let errorMessage = $state('');

	// 재생 상태 (각 오디오별)
	let playingIndex = $state<number | null>(null);
	let audioElements = $state<HTMLAudioElement[]>([]);

	const MAX_DURATION = 300; // 최대 5분
	const MAX_RECORDINGS = 3; // 최대 3개

	function formatDuration(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	async function startRecording() {
		if (!navigator.mediaDevices?.getUserMedia) {
			errorMessage = '이 브라우저에서는 녹음을 지원하지 않습니다';
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
				? 'audio/webm;codecs=opus'
				: MediaRecorder.isTypeSupported('audio/webm')
					? 'audio/webm'
					: 'audio/mp4';

			const recorder = new MediaRecorder(stream, { mimeType });
			audioChunks = [];
			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) {
					audioChunks = [...audioChunks, e.data];
				}
			};

			recorder.onstop = () => {
				stream.getTracks().forEach((t) => t.stop());
				const blob = new Blob(audioChunks, { type: mimeType });
				const reader = new FileReader();
				reader.onloadend = () => {
					const dataUrl = reader.result as string;
					onAudioChange([...audioUrls, dataUrl]);
				};
				reader.readAsDataURL(blob);
				audioChunks = [];
			};

			recorder.start(500); // 500ms 단위로 데이터 수집
			mediaRecorder = recorder;
			isRecording = true;
			recordingDuration = 0;
			errorMessage = '';

			// 타이머
			recordingTimer = setInterval(() => {
				recordingDuration += 1;
				if (recordingDuration >= MAX_DURATION) {
					stopRecording();
				}
			}, 1000);
		} catch (err) {
			if (err instanceof Error && err.name === 'NotAllowedError') {
				errorMessage = '마이크 권한이 필요합니다';
			} else {
				errorMessage = '마이크를 사용할 수 없습니다';
			}
		}
	}

	function stopRecording() {
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
		}
		if (recordingTimer) {
			clearInterval(recordingTimer);
			recordingTimer = null;
		}
		isRecording = false;
		recordingDuration = 0;
	}

	function deleteAudio(index: number) {
		// 재생 중이면 중지
		if (playingIndex === index) {
			audioElements[index]?.pause();
			playingIndex = null;
		}
		const newAudios = audioUrls.filter((_, i) => i !== index);
		onAudioChange(newAudios);
	}

	function togglePlay(index: number) {
		const el = audioElements[index];
		if (!el) return;

		if (playingIndex === index) {
			el.pause();
			playingIndex = null;
		} else {
			// 다른 오디오 중지
			if (playingIndex !== null && audioElements[playingIndex]) {
				audioElements[playingIndex].pause();
			}
			el.play();
			playingIndex = index;
			el.onended = () => {
				playingIndex = null;
			};
		}
	}

	function getAudioDuration(index: number): string {
		const el = audioElements[index];
		if (!el || !isFinite(el.duration)) return '--:--';
		return formatDuration(Math.floor(el.duration));
	}

	const canRecord = $derived(!readonly && audioUrls.length < MAX_RECORDINGS);
</script>

<div class="space-y-3">
	<!-- 녹음 버튼 -->
	{#if !readonly && canRecord}
		<div class="flex items-center gap-3">
			{#if isRecording}
				<button
					type="button"
					onclick={stopRecording}
					class="flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors animate-pulse"
				>
					<StopCircle class="w-4 h-4" />
					녹음 중지 ({formatDuration(recordingDuration)})
				</button>
				<span class="text-xs text-muted-foreground">최대 {formatDuration(MAX_DURATION)}</span>
			{:else}
				<button
					type="button"
					onclick={startRecording}
					class={cn(
						'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors',
						audioUrls.length === 0
							? 'border-border hover:bg-muted/50 text-foreground'
							: 'border-dashed border-muted-foreground/30 hover:bg-muted/30 text-muted-foreground'
					)}
				>
					<Mic class="w-4 h-4" />
					{audioUrls.length === 0 ? '음성 녹음' : '녹음 추가'}
					{#if audioUrls.length > 0}
						<span class="text-xs">({audioUrls.length}/{MAX_RECORDINGS})</span>
					{/if}
				</button>
			{/if}
		</div>
	{/if}

	<!-- 에러 메시지 -->
	{#if errorMessage}
		<p class="text-xs text-destructive">{errorMessage}</p>
	{/if}

	<!-- 녹음 목록 -->
	{#if audioUrls.length > 0}
		<div class="space-y-2">
			{#each audioUrls as dataUrl, i}
				<!-- eslint-disable-next-line svelte/no-unused-svelte-ignore -->
				<!-- svelte-ignore element_invalid_self_closing_tag -->
				<audio
					bind:this={audioElements[i]}
					src={dataUrl}
					preload="metadata"
					class="hidden"
				></audio>
				<div class="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
					<button
						type="button"
						onclick={() => togglePlay(i)}
						class="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors flex-shrink-0"
					>
						{#if playingIndex === i}
							<Pause class="w-3.5 h-3.5 text-primary" />
						{:else}
							<Play class="w-3.5 h-3.5 text-primary ml-0.5" />
						{/if}
					</button>
					<div class="flex-1 min-w-0">
						<div class="text-xs font-medium text-foreground">녹음 {i + 1}</div>
						<div class="text-xs text-muted-foreground">
							{playingIndex === i ? '재생 중' : '음성 메모'}
						</div>
					</div>
					{#if !readonly}
						<button
							type="button"
							onclick={() => deleteAudio(i)}
							class="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10 transition-colors flex-shrink-0"
						>
							<Trash2 class="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
