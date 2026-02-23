<script lang="ts">
	import { CheckSquare, ChevronRight } from 'lucide-svelte';
	import { isOverdue } from '$lib/utils/todo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import type { Memo } from '$lib/types/memo';

	interface Props {
		todos: Memo[];
	}

	const { todos }: Props = $props();
</script>

<section>
	<div class="flex items-center justify-between mb-3">
		<h2 class="text-base font-semibold flex items-center gap-2">
			<CheckSquare class="w-4 h-4 text-blue-600" />
			오늘의 할일
		</h2>
		<a href="/todos" class="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
			더보기 <ChevronRight class="w-4 h-4" />
		</a>
	</div>
	<div class="space-y-2">
		{#each todos as todo (todo.id)}
			<div class="bg-card border rounded-lg p-3 {isOverdue(todo) ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20' : ''}">
				<div class="flex items-start gap-3">
					<input
						type="checkbox"
						checked={todo.todoStatus === 'completed'}
						onchange={() => memosStore.update(todo.id, {
							todoStatus: todo.todoStatus === 'completed' ? 'pending' : 'completed',
							completedAt: todo.todoStatus === 'completed' ? undefined : Date.now()
						})}
						class="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600"
					/>
					<div class="flex-1 min-w-0">
						<h3 class="font-medium text-sm {todo.todoStatus === 'completed' ? 'line-through opacity-60' : ''} {isOverdue(todo) ? 'text-red-700 dark:text-red-300' : 'text-foreground'}">
							{todo.title}
						</h3>
						{#if todo.dueDate}
							<p class="text-xs mt-1 {isOverdue(todo) ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}">
								{isOverdue(todo) ? '⚠️ 기한초과' : '📅'}
								{new Date(todo.dueDate).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })}
								{#if todo.dueTime && todo.dueTime !== '23:59'}
									{todo.dueTime}
								{/if}
							</p>
						{:else}
							<p class="text-xs text-muted-foreground mt-1">기한 없음</p>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
</section>
