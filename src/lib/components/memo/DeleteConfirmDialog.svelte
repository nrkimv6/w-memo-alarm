<script lang="ts">
	import { AlertTriangle } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';

	interface Props {
		open: boolean;
		title?: string;
		message?: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { open = $bindable(false), title = '', message = '', onConfirm, onCancel }: Props = $props();

	function handleConfirm() {
		onConfirm();
		open = false;
	}

	function handleCancel() {
		onCancel();
		open = false;
	}
</script>

<Modal bind:open title="메모 삭제">
	<div class="flex flex-col items-center text-center py-4">
		<div class="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
			<AlertTriangle class="w-6 h-6 text-destructive" />
		</div>
		{#if message}
			<p class="text-foreground mb-2">
				{message}
			</p>
		{:else}
			<p class="text-foreground mb-2">
				<strong>"{title || '이 메모'}"</strong>를 삭제하시겠습니까?
			</p>
		{/if}
		<p class="text-sm text-muted-foreground">
			이 작업은 되돌릴 수 없습니다.
		</p>
	</div>

	{#snippet footer()}
		<Button variant="ghost" onclick={handleCancel}>취소</Button>
		<Button variant="destructive" onclick={handleConfirm}>삭제</Button>
	{/snippet}
</Modal>
