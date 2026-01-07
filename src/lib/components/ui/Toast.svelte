<script lang="ts">
	import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-svelte';
	import { toastStore, type ToastType } from '$lib/stores/toast.svelte';
	import { cn } from '$lib/utils';

	const icons: Record<ToastType, typeof CheckCircle> = {
		success: CheckCircle,
		error: AlertCircle,
		warning: AlertTriangle,
		info: Info
	};

	const styles: Record<ToastType, string> = {
		success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200',
		error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200',
		warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200',
		info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200'
	};

	const iconStyles: Record<ToastType, string> = {
		success: 'text-green-500 dark:text-green-400',
		error: 'text-red-500 dark:text-red-400',
		warning: 'text-yellow-500 dark:text-yellow-400',
		info: 'text-blue-500 dark:text-blue-400'
	};

	const toasts = $derived(toastStore.toasts);
</script>

{#if toasts.length > 0}
	<div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
		{#each toasts as toast (toast.id)}
			{@const Icon = icons[toast.type]}
			<div
				class={cn(
					'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
					'animate-in slide-in-from-right-full duration-300',
					styles[toast.type]
				)}
				role="alert"
			>
				<Icon class={cn('w-5 h-5 flex-shrink-0 mt-0.5', iconStyles[toast.type])} />
				<p class="text-sm font-medium flex-1">{toast.message}</p>
				<button
					onclick={() => toastStore.remove(toast.id)}
					class="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
					aria-label="닫기"
				>
					<X class="w-4 h-4" />
				</button>
			</div>
		{/each}
	</div>
{/if}
