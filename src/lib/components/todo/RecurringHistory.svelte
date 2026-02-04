<script lang="ts">
	import type { Memo, TodoInstance } from '$lib/types/memo';
	import { CheckCircle, XCircle, Clock } from 'lucide-svelte';

	interface Props {
		todo: Memo;
	}

	let { todo }: Props = $props();

	const instances = $derived(todo.todoInstances || []);
	const completedInstances = $derived(
		instances.filter(i => i.status === 'completed').sort((a, b) =>
			new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
		)
	);
	const skippedInstances = $derived(
		instances.filter(i => i.status === 'skipped').sort((a, b) =>
			new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
		)
	);
	const activeInstance = $derived(instances.find(i => i.status === 'pending'));

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const month = date.getMonth() + 1;
		const day = date.getDate();
		const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
		return `${month}/${day}(${dayOfWeek})`;
	}

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleString('ko-KR', {
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="border-t dark:border-gray-700 pt-3 mt-3 space-y-3">
	<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
		🔁 반복 이력
	</h4>

	<!-- 현재 활성 인스턴스 -->
	{#if activeInstance}
		<div class="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
			<div class="flex items-center gap-2 text-sm">
				<Clock class="w-4 h-4 text-blue-600 dark:text-blue-400" />
				<span class="font-medium text-blue-900 dark:text-blue-100">
					현재 일정: {formatDate(activeInstance.scheduledDate)}
				</span>
			</div>
			{#if activeInstance.postponeCount > 0}
				<p class="text-xs text-blue-700 dark:text-blue-300 mt-1 ml-6">
					📌 {activeInstance.postponeCount}회 미룸
				</p>
			{/if}
		</div>
	{/if}

	<!-- 완료 이력 -->
	{#if completedInstances.length > 0}
		<div>
			<h5 class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
				✅ 완료 ({completedInstances.length})
			</h5>
			<div class="space-y-1">
				{#each completedInstances.slice(0, 5) as instance}
					<div class="flex items-center justify-between text-xs p-2 bg-green-50 dark:bg-green-900/10 rounded">
						<div class="flex items-center gap-2">
							<CheckCircle class="w-3 h-3 text-green-600 dark:text-green-400" />
							<span class="text-gray-700 dark:text-gray-300">
								{formatDate(instance.scheduledDate)}
							</span>
						</div>
						{#if instance.completedAt}
							<span class="text-gray-500 dark:text-gray-500">
								{formatTimestamp(instance.completedAt)}
							</span>
						{/if}
					</div>
				{/each}
				{#if completedInstances.length > 5}
					<p class="text-xs text-gray-500 dark:text-gray-500 text-center py-1">
						... 외 {completedInstances.length - 5}개
					</p>
				{/if}
			</div>
		</div>
	{/if}

	<!-- 건너뛴 이력 -->
	{#if skippedInstances.length > 0}
		<div>
			<h5 class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
				⏭️ 건너뜀 ({skippedInstances.length})
			</h5>
			<div class="space-y-1">
				{#each skippedInstances.slice(0, 3) as instance}
					<div class="p-2 bg-orange-50 dark:bg-orange-900/10 rounded">
						<div class="flex items-center justify-between text-xs">
							<div class="flex items-center gap-2">
								<XCircle class="w-3 h-3 text-orange-600 dark:text-orange-400" />
								<span class="text-gray-700 dark:text-gray-300">
									{formatDate(instance.scheduledDate)}
								</span>
							</div>
							{#if instance.skippedAt}
								<span class="text-gray-500 dark:text-gray-500">
									{formatTimestamp(instance.skippedAt)}
								</span>
							{/if}
						</div>
						{#if instance.skipReason}
							<p class="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-5">
								사유: {instance.skipReason}
							</p>
						{/if}
					</div>
				{/each}
				{#if skippedInstances.length > 3}
					<p class="text-xs text-gray-500 dark:text-gray-500 text-center py-1">
						... 외 {skippedInstances.length - 3}개
					</p>
				{/if}
			</div>
		</div>
	{/if}

	{#if completedInstances.length === 0 && skippedInstances.length === 0}
		<p class="text-xs text-gray-500 dark:text-gray-500 text-center py-2">
			아직 이력이 없습니다
		</p>
	{/if}
</div>
