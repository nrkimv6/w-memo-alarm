<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let {
		open = $bindable(false),
		onConfirm,
		onSkip
	}: {
		open?: boolean;
		onConfirm: () => Promise<void>;
		onSkip: () => void;
	} = $props();

	type ResetState = 'idle' | 'running' | 'done' | 'partial';
	let resetState = $state<ResetState>('idle');
	let failedChannels = $state<string[]>([]);

	async function handleConfirm() {
		resetState = 'running';
		failedChannels = [];
		try {
			await onConfirm();
			resetState = failedChannels.length > 0 ? 'partial' : 'done';
		} catch {
			resetState = 'partial';
		}
		// 성공/부분 실패 모두 1회 플래그 기록됨 — 모달 닫기
		setTimeout(() => {
			open = false;
		}, 1800);
	}

	function handleSkip() {
		onSkip();
		open = false;
	}
</script>

<Modal bind:open title="알림 스케줄 초기화" size="sm" useHistory={false}>
	{#snippet children()}
		<div class="space-y-3 text-sm">
			{#if resetState === 'idle'}
				<p class="text-foreground leading-relaxed">
					기기에 남아 있는 이전 알림 예약을 정리하고, 현재 메모 기준으로 다시 등록합니다.
				</p>
				<p class="text-muted-foreground text-xs">
					메모 및 할일 데이터는 삭제되지 않습니다.
				</p>
			{:else if resetState === 'running'}
				<div class="flex items-center gap-2 text-muted-foreground">
					<span class="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
					<span>초기화 중...</span>
				</div>
			{:else if resetState === 'done'}
				<p class="text-green-600 dark:text-green-400 font-medium">✓ 알림 스케줄이 초기화되었습니다.</p>
			{:else if resetState === 'partial'}
				<p class="text-amber-600 dark:text-amber-400 font-medium">
					일부 채널 초기화 실패
					{#if failedChannels.length > 0}
						: {failedChannels.join(', ')}
					{/if}
				</p>
				<p class="text-muted-foreground text-xs">가능한 채널은 정리되었습니다.</p>
			{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		{#if resetState === 'idle'}
			<Button variant="ghost" size="sm" onclick={handleSkip}>건너뛰기</Button>
			<Button variant="primary" size="sm" onclick={handleConfirm}>초기화하기</Button>
		{/if}
	{/snippet}
</Modal>
