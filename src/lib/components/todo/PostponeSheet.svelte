<script lang="ts">
	import { memosStore } from '$lib/stores/memos.svelte';
	import type { Memo, PostponeInfo } from '$lib/types/memo';
	import { Calendar, AlertTriangle, X } from 'lucide-svelte';

	interface Props {
		todo: Memo;
		onClose: () => void;
	}

	let { todo, onClose }: Props = $props();

	let selectedDate = $state('');
	let postponeLimit = $state<number | null>(null);
	let enableLimit = $state(false);

	const postponeInfo = $derived(todo.postponeInfo || { count: 0, history: [] });
	const isFirstPostpone = $derived(postponeInfo.count === 0);
	const canPostpone = $derived(
		!postponeInfo.maxAllowed || postponeInfo.count < postponeInfo.maxAllowed
	);

	// 빠른 선택 옵션
	const quickOptions = $derived.by(() => {
		const today = new Date();
		const options = [];

		// 내일
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);
		options.push({
			label: '내일',
			date: tomorrow.toISOString().split('T')[0],
			preview: `${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`
		});

		// 모레
		const dayAfter = new Date(today);
		dayAfter.setDate(today.getDate() + 2);
		options.push({
			label: '모레',
			date: dayAfter.toISOString().split('T')[0],
			preview: `${dayAfter.getMonth() + 1}/${dayAfter.getDate()}`
		});

		// 이번 주말 (토요일)
		const saturday = new Date(today);
		const daysUntilSaturday = 6 - today.getDay();
		saturday.setDate(today.getDate() + daysUntilSaturday);
		if (daysUntilSaturday > 0) {
			options.push({
				label: '이번 주말',
				date: saturday.toISOString().split('T')[0],
				preview: `${saturday.getMonth() + 1}/${saturday.getDate()}`
			});
		}

		// 다음 주 (다음 월요일)
		const nextMonday = new Date(today);
		const daysUntilNextMonday = 8 - today.getDay();
		nextMonday.setDate(today.getDate() + daysUntilNextMonday);
		options.push({
			label: '다음 주',
			date: nextMonday.toISOString().split('T')[0],
			preview: `${nextMonday.getMonth() + 1}/${nextMonday.getDate()}`
		});

		return options;
	});

	function selectQuick(date: string) {
		selectedDate = date;
	}

	async function handlePostpone() {
		if (!selectedDate) {
			alert('날짜를 선택해주세요');
			return;
		}

		if (!canPostpone) {
			alert('미루기 횟수를 초과했습니다');
			return;
		}

		const newPostponeInfo: PostponeInfo = {
			count: postponeInfo.count + 1,
			originalDueDate: postponeInfo.originalDueDate || todo.dueDate,
			maxAllowed: enableLimit ? postponeLimit || undefined : postponeInfo.maxAllowed,
			history: [
				...postponeInfo.history,
				{
					from: todo.dueDate!,
					to: selectedDate,
					postponedAt: Date.now()
				}
			]
		};

		await memosStore.updateMemo(todo.id, {
			dueDate: selectedDate,
			postponeInfo: newPostponeInfo,
			// 자동 알람 재계산 (Phase 2에서 구현)
			// 수동 알람은 유지 (과거 시각이면 무시)
		});

		onClose();
	}
</script>

<div class="fixed inset-0 bg-black/50 flex items-end z-50 sm:items-center sm:justify-center">
	<div class="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
		<!-- Header -->
		<div class="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
				📌 미루기
			</h2>
			<button
				onclick={onClose}
				class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
			>
				<X class="w-5 h-5" />
			</button>
		</div>

		<div class="p-6 space-y-6">
			<!-- Todo Info -->
			<div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
				<h3 class="font-medium text-gray-900 dark:text-white mb-1">{todo.title}</h3>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					현재 기한: {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString('ko-KR') : '없음'}
				</p>
			</div>

			<!-- Warning (2nd postpone onwards) -->
			{#if !isFirstPostpone}
				<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
					<div class="flex items-start gap-3">
						<AlertTriangle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
						<div class="flex-1">
							<p class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
								⚠️ 이 할일은 이미 {postponeInfo.count}회 미뤄졌습니다.
							</p>
							{#if postponeInfo.originalDueDate}
								<p class="text-xs text-yellow-700 dark:text-yellow-300">
									원래 기한: {new Date(postponeInfo.originalDueDate).toLocaleDateString('ko-KR')}
									→ 현재: {todo.dueDate ? new Date(todo.dueDate).toLocaleDateString('ko-KR') : '없음'}
								</p>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- Cannot Postpone -->
			{#if !canPostpone}
				<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
					<p class="text-sm font-medium text-red-800 dark:text-red-200">
						미루기 횟수를 초과했습니다. 완료 또는 건너뛰기만 가능합니다.
					</p>
				</div>
			{:else}
				<!-- Quick Select -->
				<div>
					<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">빠른 선택</h4>
					<div class="grid grid-cols-2 gap-2">
						{#each quickOptions as option}
							<button
								onclick={() => selectQuick(option.date)}
								class="p-3 border rounded-lg text-left transition-colors {
									selectedDate === option.date
										? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
										: 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-600'
								}"
							>
								<div class="font-medium text-sm text-gray-900 dark:text-white">
									{option.label}
								</div>
								<div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
									{option.preview}
								</div>
							</button>
						{/each}
					</div>
				</div>

				<!-- Date Picker -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						<Calendar class="inline w-4 h-4 mr-1" />
						날짜 직접 선택
					</label>
					<input
						type="date"
						bind:value={selectedDate}
						min={new Date().toISOString().split('T')[0]}
						class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
					/>
				</div>

				<!-- Postpone Limit (2nd postpone onwards) -->
				{#if !isFirstPostpone}
					<div class="border dark:border-gray-700 rounded-lg p-4 space-y-3">
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={enableLimit}
								class="rounded"
							/>
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								미루기 횟수 제한 설정
							</span>
						</label>

						{#if enableLimit}
							<div>
								<label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">
									앞으로 최대:
								</label>
								<select
									bind:value={postponeLimit}
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
								>
									<option value={1}>1회</option>
									<option value={2}>2회</option>
									<option value={3}>3회</option>
									<option value={5}>5회</option>
								</select>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
									⚠️ 소진 시 완료/건너뛰기만 가능
								</p>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Postpone History -->
				{#if postponeInfo.history.length > 0}
					<div>
						<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							미루기 이력 (총 {postponeInfo.count}회)
						</h4>
						<div class="space-y-1 max-h-32 overflow-y-auto">
							{#each postponeInfo.history.slice(-5).reverse() as record}
								<div class="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded px-3 py-2">
									{new Date(record.from).toLocaleDateString('ko-KR')}
									→ {new Date(record.to).toLocaleDateString('ko-KR')}
									<span class="text-gray-500 ml-2">
										({new Date(record.postponedAt).toLocaleDateString('ko-KR')})
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Actions -->
		<div class="sticky bottom-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 px-6 py-4 flex gap-3">
			<button
				onclick={onClose}
				class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
			>
				취소
			</button>
			<button
				onclick={handlePostpone}
				disabled={!canPostpone || !selectedDate}
				class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				미루기
			</button>
		</div>
	</div>
</div>
