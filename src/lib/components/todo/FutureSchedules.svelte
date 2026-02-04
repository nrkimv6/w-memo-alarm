<script lang="ts">
	import type { Memo } from '$lib/types/memo';
	import { getUpcomingSchedules, getRecurrenceDescription } from '$lib/utils/recurrence';
	import { Calendar, Clock } from 'lucide-svelte';

	interface Props {
		todo: Memo;
		count?: number;
	}

	let { todo, count = 5 }: Props = $props();

	const schedules = $derived.by(() => {
		if (!todo.recurrence || !todo.todoInstances) return [];
		return getUpcomingSchedules(todo.recurrence, todo.todoInstances, count);
	});

	const recurrenceDesc = $derived(
		todo.recurrence ? getRecurrenceDescription(todo.recurrence) : ''
	);

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const month = date.getMonth() + 1;
		const day = date.getDate();
		const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
		return `${month}/${day}(${dayOfWeek})`;
	}

	function getRelativeDay(dateStr: string): string {
		const date = new Date(dateStr);
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		today.setHours(0, 0, 0, 0);
		tomorrow.setHours(0, 0, 0, 0);
		date.setHours(0, 0, 0, 0);

		if (date.getTime() === today.getTime()) return '오늘';
		if (date.getTime() === tomorrow.getTime()) return '내일';

		const daysDiff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
		if (daysDiff > 0 && daysDiff <= 7) return `${daysDiff}일 후`;

		return '';
	}
</script>

<div class="border dark:border-gray-700 rounded-lg p-4 space-y-3">
	<div class="flex items-center gap-2">
		<Calendar class="w-4 h-4 text-purple-600 dark:text-purple-400" />
		<h3 class="text-sm font-medium text-gray-900 dark:text-white">
			다가오는 일정
		</h3>
	</div>

	<p class="text-xs text-gray-600 dark:text-gray-400">
		{recurrenceDesc}
	</p>

	{#if schedules.length > 0}
		<div class="space-y-2">
			{#each schedules as schedule, idx}
				<div class="flex items-center justify-between p-2 rounded {
					schedule.isActive
						? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
						: 'bg-gray-50 dark:bg-gray-800'
				}">
					<div class="flex items-center gap-2">
						<span class="text-xs font-medium {
							schedule.isActive
								? 'text-blue-900 dark:text-blue-100'
								: 'text-gray-700 dark:text-gray-300'
						}">
							{formatDate(schedule.date)}
						</span>
						{#if getRelativeDay(schedule.date)}
							<span class="text-xs text-gray-500 dark:text-gray-500">
								({getRelativeDay(schedule.date)})
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						{#if schedule.isActive}
							<span class="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full">
								현재
							</span>
						{/if}
						{#if schedule.isPostponed}
							<span class="text-xs text-orange-600 dark:text-orange-400">
								📌 미룸
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-xs text-gray-500 dark:text-gray-500 text-center py-2">
			반복이 종료되었습니다
		</p>
	{/if}
</div>
