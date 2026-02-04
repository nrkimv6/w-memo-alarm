<script lang="ts">
	import { onMount } from 'svelte';
	import { CheckCircle, Undo2 } from 'lucide-svelte';

	interface Props {
		message: string;
		onUndo: () => void;
		onDismiss: () => void;
		duration?: number;
	}

	let { message, onUndo, onDismiss, duration = 3000 }: Props = $props();

	onMount(() => {
		const timer = setTimeout(() => {
			onDismiss();
		}, duration);

		return () => {
			clearTimeout(timer);
		};
	});

	function handleUndo() {
		onUndo();
		onDismiss();
	}
</script>

<div class="fixed bottom-20 left-4 right-4 z-50 flex justify-center animate-in slide-in-from-bottom">
	<div class="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 max-w-md">
		<CheckCircle class="w-5 h-5 text-green-400 dark:text-green-600 flex-shrink-0" />
		<span class="flex-1 text-sm font-medium">{message}</span>
		<button
			onclick={handleUndo}
			class="flex items-center gap-1 px-3 py-1.5 bg-white/20 dark:bg-gray-900/20 hover:bg-white/30 dark:hover:bg-gray-900/30 rounded text-sm font-medium transition-colors"
		>
			<Undo2 class="w-4 h-4" />
			실행 취소
		</button>
	</div>
</div>

<style>
	@keyframes slide-in-from-bottom {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	.animate-in {
		animation-duration: 200ms;
		animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
	}
	.slide-in-from-bottom {
		animation-name: slide-in-from-bottom;
	}
</style>
