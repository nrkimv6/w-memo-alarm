<script lang="ts">
	import type { Memo } from "$lib/types/memo";
	import {
		getTodoStatsSummary,
		type TodoStatsSummary,
	} from "$lib/utils/todoStats";
	import {
		getTodayProgress,
		getWeekProgress,
		getMonthProgress,
	} from "$lib/utils/todoProgress";
	import {
		TrendingUp,
		Flame,
		Clock,
		CheckCircle,
		Circle,
		SkipForward,
	} from "lucide-svelte";

	interface Props {
		todos: Memo[];
	}

	let { todos }: Props = $props();

	const stats = $derived.by(() => {
		const todayProgress = getTodayProgress(todos);
		const weekProgress = getWeekProgress(todos);
		const monthProgress = getMonthProgress(todos);

		return getTodoStatsSummary(
			todos,
			todayProgress,
			weekProgress,
			monthProgress,
		);
	});

	function getStreakEmoji(streak: number): string {
		if (streak === 0) return "😴";
		if (streak < 3) return "🔥";
		if (streak < 7) return "🔥🔥";
		if (streak < 14) return "🔥🔥🔥";
		if (streak < 30) return "🏆";
		return "👑";
	}

	function getStreakMessage(streak: number): string {
		if (streak === 0) return "오늘부터 시작해보세요!";
		if (streak === 1) return "좋은 시작입니다!";
		if (streak < 7) return "계속 이어가세요!";
		if (streak < 30) return "대단합니다!";
		return "완벽합니다!";
	}
</script>

<div class="space-y-4">
	<!-- 헤더 -->
	<div class="flex items-center gap-2 pb-2 border-b border-border">
		<TrendingUp class="w-5 h-5 text-primary" />
		<h3 class="text-lg font-semibold text-foreground">통계</h3>
	</div>

	<!-- 스트릭 -->
	<div
		class="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4"
	>
		<div class="flex items-center gap-3">
			<div class="text-4xl">
				{getStreakEmoji(stats.streak)}
			</div>
			<div class="flex-1">
				<div class="text-2xl font-bold text-gray-900 dark:text-white">
					{stats.streak}일 연속 완료
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">
					{getStreakMessage(stats.streak)}
				</div>
			</div>
		</div>
	</div>

	<!-- 완료율 -->
	<div class="grid grid-cols-3 gap-3">
		<!-- 오늘 -->
		<div
			class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3"
		>
			<div
				class="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1"
			>
				오늘
			</div>
			<div class="text-2xl font-bold text-blue-900 dark:text-blue-100">
				{stats.todayProgress.percentage}%
			</div>
			<div class="text-xs text-blue-600 dark:text-blue-400 mt-1">
				{stats.todayProgress.completed}/{stats.todayProgress.total}
			</div>
		</div>

		<!-- 이번 주 -->
		<div
			class="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3"
		>
			<div
				class="text-xs text-purple-700 dark:text-purple-300 font-medium mb-1"
			>
				이번 주
			</div>
			<div class="text-2xl font-bold text-purple-900 dark:text-purple-100">
				{stats.weekProgress.percentage}%
			</div>
			<div class="text-xs text-purple-600 dark:text-purple-400 mt-1">
				{stats.weekProgress.completed}/{stats.weekProgress.total}
			</div>
		</div>

		<!-- 이번 달 -->
		<div
			class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3"
		>
			<div
				class="text-xs text-green-700 dark:text-green-300 font-medium mb-1"
			>
				이번 달
			</div>
			<div class="text-2xl font-bold text-green-900 dark:text-green-100">
				{stats.monthProgress.percentage}%
			</div>
			<div class="text-xs text-green-600 dark:text-green-400 mt-1">
				{stats.monthProgress.completed}/{stats.monthProgress.total}
			</div>
		</div>
	</div>

	<!-- 전체 통계 -->
	<div class="grid grid-cols-4 gap-2">
		<div class="bg-card border border-border rounded-lg p-3 text-center">
			<div class="flex items-center justify-center mb-1">
				<Circle class="w-4 h-4 text-muted-foreground" />
			</div>
			<div class="text-lg font-bold text-gray-900 dark:text-white">
				{stats.totalTodos}
			</div>
			<div class="text-xs text-muted-foreground">전체</div>
		</div>

		<div
			class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center"
		>
			<div class="flex items-center justify-center mb-1">
				<CheckCircle
					class="w-4 h-4 text-green-600 dark:text-green-400"
				/>
			</div>
			<div class="text-lg font-bold text-green-900 dark:text-green-100">
				{stats.totalCompleted}
			</div>
			<div class="text-xs text-green-600 dark:text-green-400">완료</div>
		</div>

		<div
			class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-center"
		>
			<div class="flex items-center justify-center mb-1">
				<Clock class="w-4 h-4 text-blue-600 dark:text-blue-400" />
			</div>
			<div class="text-lg font-bold text-blue-900 dark:text-blue-100">
				{stats.totalPending}
			</div>
			<div class="text-xs text-blue-600 dark:text-blue-400">진행 중</div>
		</div>

		<div
			class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-center"
		>
			<div class="flex items-center justify-center mb-1">
				<SkipForward
					class="w-4 h-4 text-orange-600 dark:text-orange-400"
				/>
			</div>
			<div class="text-lg font-bold text-orange-900 dark:text-orange-100">
				{stats.totalSkipped}
			</div>
			<div class="text-xs text-orange-600 dark:text-orange-400">
				건너뜀
			</div>
		</div>
	</div>

	<!-- 미루기 통계 -->
	{#if stats.mostPostponedTodos.length > 0}
		<div class="border dark:border-gray-700 rounded-lg p-4">
			<h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
				<Clock class="w-4 h-4 text-orange-600 dark:text-orange-400" />
				가장 많이 미룬 할일
			</h4>
			<div class="space-y-2">
				{#each stats.mostPostponedTodos as todo, idx}
					<div class="flex items-start gap-2 text-sm">
						<span
							class="flex-shrink-0 w-5 h-5 bg-secondary/10 text-secondary rounded-full flex items-center justify-center text-xs font-medium"
						>
							{idx + 1}
						</span>
						<div class="flex-1 min-w-0">
							<div class="text-foreground font-medium truncate">
								{todo.title}
							</div>
							<div class="text-xs text-muted-foreground">
								{todo.postponeInfo?.count || 0}회 미룸
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- 총 미루기 횟수 -->
	{#if stats.totalPostpones > 0}
		<div class="text-center text-sm text-gray-600 dark:text-gray-400">
			총 {stats.totalPostpones}회 미뤄졌습니다
		</div>
	{/if}
</div>
