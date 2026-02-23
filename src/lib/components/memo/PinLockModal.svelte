<script lang="ts">
	import { Lock, Eye, EyeOff, X } from 'lucide-svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { verifyPin, unlockSession, hasPinSet, setPin, removePin } from '$lib/utils/memoPinLock';
	import { cn } from '$lib/utils';

	interface Props {
		open: boolean;
		mode: 'unlock' | 'setup' | 'change' | 'remove';
		hint?: string;
		onSuccess: () => void;
		onClose: () => void;
	}

	let { open = $bindable(false), mode, hint, onSuccess, onClose }: Props = $props();

	let pin = $state('');
	let confirmPin = $state('');
	let oldPin = $state('');
	let showPin = $state(false);
	let error = $state('');
	let step = $state<'old' | 'new' | 'confirm'>('new');
	let isLoading = $state(false);

	$effect(() => {
		if (open) {
			pin = '';
			confirmPin = '';
			oldPin = '';
			error = '';
			showPin = false;
			step = mode === 'change' || mode === 'remove' ? 'old' : 'new';
		}
	});

	const title = $derived(() => {
		if (mode === 'unlock') return '잠긴 메모';
		if (mode === 'setup') return 'PIN 설정';
		if (mode === 'change') return 'PIN 변경';
		if (mode === 'remove') return 'PIN 제거';
		return 'PIN';
	});

	const stepLabel = $derived(() => {
		if (mode === 'unlock') return 'PIN 입력';
		if (mode === 'setup') {
			if (step === 'new') return 'PIN 입력 (4-8자리)';
			if (step === 'confirm') return 'PIN 확인';
		}
		if (mode === 'change') {
			if (step === 'old') return '현재 PIN 입력';
			if (step === 'new') return '새 PIN 입력';
			if (step === 'confirm') return '새 PIN 확인';
		}
		if (mode === 'remove') return '현재 PIN 입력';
		return '';
	});

	function getDigitPad() {
		return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
	}

	function getCurrentPin(): string {
		if (mode === 'unlock') return pin;
		if (mode === 'setup') return step === 'new' ? pin : confirmPin;
		if (mode === 'change') {
			if (step === 'old') return oldPin;
			if (step === 'new') return pin;
			return confirmPin;
		}
		if (mode === 'remove') return oldPin;
		return pin;
	}

	function setCurrentPin(val: string) {
		if (mode === 'unlock') pin = val;
		else if (mode === 'setup') {
			if (step === 'new') pin = val;
			else confirmPin = val;
		} else if (mode === 'change') {
			if (step === 'old') oldPin = val;
			else if (step === 'new') pin = val;
			else confirmPin = val;
		} else if (mode === 'remove') {
			oldPin = val;
		}
	}

	function handleDigit(digit: string) {
		if (digit === '⌫') {
			const curr = getCurrentPin();
			setCurrentPin(curr.slice(0, -1));
			error = '';
		} else if (digit !== '') {
			const curr = getCurrentPin();
			if (curr.length < 8) {
				setCurrentPin(curr + digit);
				error = '';
			}
		}
	}

	async function handleConfirm() {
		error = '';
		const curr = getCurrentPin();

		if (curr.length < 4) {
			error = 'PIN은 최소 4자리입니다';
			return;
		}

		isLoading = true;
		try {
			if (mode === 'unlock') {
				const ok = await verifyPin(curr);
				if (ok) {
					unlockSession();
					onSuccess();
				} else {
					error = '잘못된 PIN입니다';
					pin = '';
				}
			} else if (mode === 'setup') {
				if (step === 'new') {
					step = 'confirm';
				} else {
					// confirm 단계
					if (pin !== confirmPin) {
						error = 'PIN이 일치하지 않습니다';
						confirmPin = '';
					} else {
						await setPin(pin);
						unlockSession();
						onSuccess();
					}
				}
			} else if (mode === 'change') {
				if (step === 'old') {
					const ok = await verifyPin(oldPin);
					if (!ok) {
						error = '현재 PIN이 틀렸습니다';
						oldPin = '';
					} else {
						step = 'new';
					}
				} else if (step === 'new') {
					step = 'confirm';
				} else {
					if (pin !== confirmPin) {
						error = 'PIN이 일치하지 않습니다';
						confirmPin = '';
					} else {
						await setPin(pin);
						unlockSession();
						onSuccess();
					}
				}
			} else if (mode === 'remove') {
				const ok = await verifyPin(oldPin);
				if (!ok) {
					error = 'PIN이 틀렸습니다';
					oldPin = '';
				} else {
					removePin();
					onSuccess();
				}
			}
		} finally {
			isLoading = false;
		}
	}
</script>

<Modal bind:open title={title()} size="sm" onClose={onClose}>
	<div class="space-y-6">
		<!-- 아이콘 + 설명 -->
		<div class="text-center space-y-2">
			<div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
				<Lock class="w-6 h-6 text-primary" />
			</div>
			<p class="text-sm text-muted-foreground">{stepLabel()}</p>
			{#if mode === 'unlock' && hint}
				<p class="text-xs text-muted-foreground italic">힌트: {hint}</p>
			{/if}
		</div>

		<!-- PIN 표시 (점) -->
		<div class="flex justify-center gap-3">
			{#each { length: 8 } as _, i}
				{@const curr = getCurrentPin()}
				{@const filled = i < curr.length}
				{@const visible = showPin && filled}
				{#if i < Math.max(4, curr.length + 1, 4)}
					<div class={cn(
						'w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all',
						filled ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'
					)}>
						{#if visible}
							<span class="text-sm font-bold">{curr[i]}</span>
						{:else if filled}
							<div class="w-2.5 h-2.5 rounded-full bg-primary"></div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>

		<!-- 에러 메시지 -->
		{#if error}
			<p class="text-sm text-destructive text-center">{error}</p>
		{/if}

		<!-- 숫자 패드 -->
		<div class="grid grid-cols-3 gap-2">
			{#each getDigitPad() as digit}
				{#if digit === ''}
					<div></div>
				{:else if digit === '⌫'}
					<button
						type="button"
						onclick={() => handleDigit(digit)}
						class="h-12 rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center text-lg font-semibold transition-colors active:scale-95"
					>
						{digit}
					</button>
				{:else}
					<button
						type="button"
						onclick={() => handleDigit(digit)}
						class="h-12 rounded-xl bg-card border border-border hover:bg-muted/50 flex items-center justify-center text-lg font-semibold transition-colors active:scale-95"
					>
						{digit}
					</button>
				{/if}
			{/each}
		</div>

		<!-- 액션 버튼 -->
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => (showPin = !showPin)}
				class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
			>
				{#if showPin}
					<EyeOff class="w-3.5 h-3.5" />
					숨기기
				{:else}
					<Eye class="w-3.5 h-3.5" />
					보기
				{/if}
			</button>
			<div class="flex-1"></div>
			<Button variant="outline" onclick={onClose}>취소</Button>
			<Button
				onclick={handleConfirm}
				disabled={isLoading || getCurrentPin().length < 4}
			>
				{mode === 'unlock' ? '열기' : step === 'confirm' || mode === 'remove' ? '완료' : '다음'}
			</Button>
		</div>
	</div>
</Modal>
