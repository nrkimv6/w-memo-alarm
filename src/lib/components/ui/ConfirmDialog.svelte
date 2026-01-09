<script lang="ts">
	import { AlertTriangle } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';

	interface Props {
		open: boolean;
		title?: string;
		message: string;
		confirmText?: string;
		cancelText?: string;
		variant?: 'default' | 'destructive';
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open = $bindable(false),
		title = '확인',
		message = '',
		confirmText = '확인',
		cancelText = '취소',
		variant = 'default',
		onConfirm,
		onCancel
	}: Props = $props();

	function handleConfirm() {
		onConfirm();
		open = false;
	}

	function handleCancel() {
		onCancel();
		open = false;
	}
</script>

<Modal bind:open {title}>
	<div class="flex flex-col items-center text-center py-4">
		{#if variant === 'destructive'}
			<div class="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
				<AlertTriangle class="w-6 h-6 text-destructive" />
			</div>
		{/if}
		<p class="text-foreground mb-2">
			{message}
		</p>
		<p class="text-sm text-muted-foreground">
			이 작업은 되돌릴 수 없습니다.
		</p>
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={handleCancel}>{cancelText}</Button>
		<Button {variant} onclick={handleConfirm}>{confirmText}</Button>
	{/snippet}
</Modal>
