<script lang="ts">
	import type { Memo } from '$lib/types/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { Bell, X, Calendar, Clock } from 'lucide-svelte';
	import { formatDueDate, getPriorityColor, getPriorityLabel } from '$lib/utils/todo';

	interface Props {
		todo: Memo;
		onClose: () => void;
		onPostpone?: (todo: Memo) => void;
	}

	let { todo, onClose, onPostpone }: Props = $props();

	async function handleComplete() {
		await memosStore.updateMemo(todo.id, {
			todoStatus: 'completed',
			completedAt: Date.now()
		});
		onClose();
	}

	function handlePostpone() {
		onPostpone?.(todo);
	}
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
	<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95">
		<!-- Header -->
		<div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-6 text-white relative">
			<button
				onclick={onClose}
				class="absolute top-4 right-4 text-white/80 hover:text-white"
			>
				<X class="w-6 h-6" />
			</button>
			<div class="flex items-center gap-3 mb-2">
				<div class="bg-white/20 rounded-full p-3">
					<Bell class="w-8 h-8" />
				</div>
				<div>
					<h2 class="text-2xl font-bold">알람!</h2>
					<p class="text-white/90 text-sm">지금 해야 해요</p>
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="p-6 space-y-4">
			<!-- Title -->
			<div>
				<h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
					{todo.title}
				</h3>
				{#if todo.content}
					<p class="text-sm text-gray-600 dark:text-gray-400">
						{todo.content}
					</p>
				{/if}
			</div>

			<!-- Due Date & Priority -->
			<div class="flex items-center gap-3 flex-wrap">
				{#if todo.dueDate}
					<div class="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
						<Calendar class="w-4 h-4" />
						{formatDueDate(todo)}
					</div>
				{/if}
				{#if todo.dueTime}
					<div class="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
						<Clock class="w-4 h-4" />
						{todo.dueTime}
					</div>
				{/if}
				{#if todo.todoPriority}
					<span class="px-2 py-1 text-xs font-medium rounded {getPriorityColor(todo.todoPriority)}">
						{getPriorityLabel(todo.todoPriority)}
					</span>
				{/if}
			</div>

			<!-- Tags -->
			{#if todo.tags.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each todo.tags as tag}
						<span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
							#{tag}
						</span>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="px-6 pb-6 flex gap-3">
			<button
				onclick={onClose}
				class="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
			>
				닫기
			</button>
			{#if todo.dueDate}
				<button
					onclick={handlePostpone}
					class="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
				>
					📌 미루기
				</button>
			{/if}
			<button
				onclick={handleComplete}
				class="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
			>
				✅ 완료
			</button>
		</div>
	</div>
</div>

<style>
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes zoom-in-95 {
		from { transform: scale(0.95); opacity: 0; }
		to { transform: scale(1); opacity: 1; }
	}
	.animate-in {
		animation-duration: 200ms;
		animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
	}
	.fade-in {
		animation-name: fade-in;
	}
	.zoom-in-95 {
		animation-name: zoom-in-95;
	}
</style>
