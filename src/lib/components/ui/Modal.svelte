<script lang="ts">
	import { cn } from '$lib/utils';
	import { fade } from 'svelte/transition';
	import { X } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let {
		open = $bindable(false),
		title,
		children,
		footer,
		class: className = '',
		useHistory = true
	}: {
		open?: boolean;
		title?: string;
		children?: any;
		footer?: any;
		class?: string;
		useHistory?: boolean;
	} = $props();

	let hasAddedHistory = $state(false);

	function close() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) close();
	}

	// 히스토리 연동: 모달 열릴 때 pushState, back 버튼으로 닫기
	$effect(() => {
		if (typeof window === 'undefined' || !useHistory) return;

		if (open && !hasAddedHistory) {
			// 모달 열릴 때 히스토리 추가
			history.pushState({ modal: true }, '');
			hasAddedHistory = true;
		} else if (!open && hasAddedHistory) {
			// 모달이 닫힐 때 (back 버튼이 아닌 다른 방법으로)
			hasAddedHistory = false;
		}
	});

	onMount(() => {
		if (typeof window === 'undefined' || !useHistory) return;

		function handlePopState(e: PopStateEvent) {
			if (open && hasAddedHistory) {
				// back 버튼으로 모달 닫기
				hasAddedHistory = false;
				open = false;
			}
		}

		window.addEventListener('popstate', handlePopState);
		return () => {
			window.removeEventListener('popstate', handlePopState);
			// 컴포넌트 언마운트 시 히스토리 정리
			if (hasAddedHistory) {
				history.back();
			}
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm transition-opacity"
		transition:fade={{ duration: 200 }}
		onclick={close}
		role="presentation"
	></div>

	<!-- Modal Content -->
	<div class="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
		<div
			class={cn(
				'bg-card w-full max-w-lg rounded-xl border border-border shadow-lg pointer-events-auto',
				'modal-appear flex flex-col max-h-[90dvh]',
				className
			)}
			role="dialog"
			aria-modal="true"
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-6 pb-4 border-b border-border/40">
				<h2 class="text-xl font-bold tracking-tight">{title}</h2>
				<button
					onclick={close}
					class="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
				>
					<X class="w-5 h-5" />
					<span class="sr-only">Close</span>
				</button>
			</div>

			<!-- Body -->
			<div class="p-6 overflow-y-auto custom-scrollbar flex-1">
				{@render children?.()}
			</div>

			<!-- Footer -->
			{#if footer}
				<div
					class="p-6 pt-4 border-t border-border/40 flex justify-end gap-2 bg-muted/20 rounded-b-xl"
				>
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
