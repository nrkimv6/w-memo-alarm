<script lang="ts">
	import { memosStore } from '$lib/stores/memos.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import type { Memo, TodoPriority, TodoTiming } from '$lib/types/memo';
	import { Calendar, Clock, Bell, AlertCircle, Repeat, Folder } from 'lucide-svelte';

	interface Props {
		memo?: Memo;
		onClose: () => void;
		onSave?: (memo: Memo) => void;
	}

	let { memo, onClose, onSave }: Props = $props();

	const isEdit = !!memo;

	// Form state
	let title = $state(memo?.title || '');
	let content = $state(memo?.content || '');
	let tags = $state<string[]>(memo?.tags || []);
	let todoPriority = $state<TodoPriority>(memo?.todoPriority || 'medium');
	let dueDate = $state(memo?.dueDate || '');
	let dueTime = $state(memo?.dueTime || '');
	let allDay = $state(memo?.dueTime === '23:59' || false);

	// TodoTiming state
	let useGlobalRemind = $state(memo?.todoTiming?.useGlobalRemind ?? true);
	let useGlobalAutoAlert = $state(memo?.todoTiming?.useGlobalAutoAlert ?? true);
	let autoAlertBefore = $state(memo?.todoTiming?.autoAlertBefore);
	let showOverdue = $state(memo?.todoTiming?.showOverdue ?? true);
	let remindTimes = $state<Array<{ type: 'time' | 'before_due'; value: string }>>(
		memo?.todoTiming?.remindTimes || []
	);
	let alertTimes = $state<Array<{ type: 'datetime' | 'before_due'; value: string }>>(
		memo?.todoTiming?.alertTimes || []
	);

	// UI state
	let showAlarmSection = $state(!!dueDate || !!memo?.dueDate);
	let tagInput = $state('');

	// Computed
	const globalRemindTime = $derived(settingsStore.settings.todoDefaults.remind.time);
	const globalAutoAlertEnabled = $derived(settingsStore.settings.todoDefaults.autoAlert.enabled);
	const globalAutoAlertMinutes = $derived(settingsStore.settings.todoDefaults.autoAlert.minutesBefore);

	// Watch dueDate changes
	$effect(() => {
		if (dueDate) {
			showAlarmSection = true;
		}
	});

	// Watch allDay toggle
	$effect(() => {
		if (allDay) {
			dueTime = '23:59';
		} else if (dueTime === '23:59') {
			dueTime = '';
		}
	});

	function handlePriorityChange(priority: TodoPriority) {
		todoPriority = priority;
	}

	function addTag() {
		const trimmed = tagInput.trim();
		if (trimmed && !tags.includes(trimmed)) {
			tags = [...tags, trimmed];
			tagInput = '';
		}
	}

	function removeTag(tag: string) {
		tags = tags.filter(t => t !== tag);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			addTag();
		}
	}

	async function handleSubmit() {
		if (!title.trim()) {
			alert('제목을 입력해주세요');
			return;
		}

		const todoTiming: TodoTiming = {
			useGlobalRemind,
			remindTimes: useGlobalRemind ? [] : remindTimes,
			useGlobalAutoAlert,
			autoAlertBefore: useGlobalAutoAlert ? globalAutoAlertMinutes : autoAlertBefore,
			alertTimes: alertTimes,
			showOverdue
		};

		const memoData = {
			...(memo || {}),
			title: title.trim(),
			content: content.trim(),
			tags,
			memoType: 'todo' as const,
			todoPriority,
			todoStatus: memo?.todoStatus || 'pending' as const,
			dueDate: dueDate || undefined,
			dueTime: allDay ? '23:59' : (dueTime || undefined),
			todoTiming
		};

		if (isEdit && memo) {
			await memosStore.updateMemo(memo.id, memoData);
		} else {
			await memosStore.addMemo({
				...memoData,
				id: '',
				createdAt: Date.now(),
				updatedAt: Date.now(),
				isPinned: false,
				isFavorite: false,
				isActive: true
			} as Memo);
		}

		if (onSave) {
			onSave(memoData as Memo);
		}

		onClose();
	}
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
		<div class="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
				{isEdit ? '할일 수정' : '새 할일'}
			</h2>
			<button
				onclick={onClose}
				class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
			>
				✕
			</button>
		</div>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="p-6 space-y-6">
			<!-- 제목 -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					제목 *
				</label>
				<input
					type="text"
					bind:value={title}
					placeholder="할일 제목을 입력하세요"
					class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
					required
				/>
			</div>

			<!-- 메모 -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					메모
				</label>
				<textarea
					bind:value={content}
					placeholder="메모를 입력하세요 (선택사항)"
					rows="3"
					class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
				></textarea>
			</div>

			<!-- 우선순위 -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					우선순위
				</label>
				<div class="flex gap-2">
					{#each [
						{ value: 'low', label: '낮음', color: 'bg-gray-200 text-gray-700 hover:bg-gray-300' },
						{ value: 'medium', label: '보통', color: 'bg-blue-200 text-blue-700 hover:bg-blue-300' },
						{ value: 'high', label: '높음', color: 'bg-orange-200 text-orange-700 hover:bg-orange-300' },
						{ value: 'urgent', label: '긴급', color: 'bg-red-200 text-red-700 hover:bg-red-300' }
					] as priority}
						<button
							type="button"
							onclick={() => handlePriorityChange(priority.value as TodoPriority)}
							class="flex-1 px-4 py-2 rounded-lg font-medium transition-colors {todoPriority === priority.value ? priority.color : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'}"
						>
							{priority.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- 기한 -->
			<div class="space-y-3">
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
					<Calendar class="inline w-4 h-4 mr-1" />
					기한
				</label>
				<div class="flex gap-3">
					<input
						type="date"
						bind:value={dueDate}
						class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
					/>
					{#if !allDay}
						<input
							type="time"
							bind:value={dueTime}
							disabled={!dueDate}
							class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
						/>
					{/if}
				</div>
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={allDay} disabled={!dueDate} class="rounded" />
					<span class="text-sm text-gray-600 dark:text-gray-400">하루 종일</span>
				</label>
			</div>

			<!-- 알람 섹션 -->
			{#if showAlarmSection}
				<div class="border dark:border-gray-700 rounded-lg p-4 space-y-4">
					<h3 class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
						<Bell class="w-4 h-4" />
						알람 (Phase 2에서 활성화)
					</h3>

					<!-- 상기 -->
					<div class="space-y-2">
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={useGlobalRemind} class="rounded" />
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								상기: 매일 {globalRemindTime}
							</span>
						</label>
						<p class="text-xs text-gray-500 dark:text-gray-400 ml-6">
							앱 전역 상기 시간 사용 (설정에서 변경 가능)
						</p>
					</div>

					<!-- 자동 알람 -->
					{#if dueDate}
						<div class="space-y-2">
							<label class="flex items-center gap-2 cursor-pointer">
								<input type="checkbox" bind:checked={useGlobalAutoAlert} class="rounded" />
								<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
									알람: 기한 {globalAutoAlertMinutes}분 전
								</span>
							</label>
							<p class="text-xs text-gray-500 dark:text-gray-400 ml-6">
								앱 전역 자동 알람 사용 (설정에서 변경 가능)
							</p>
						</div>
					{/if}

					<!-- 기한 초과 표시 -->
					<label class="flex items-center gap-2 cursor-pointer">
						<input type="checkbox" bind:checked={showOverdue} class="rounded" />
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
							기한 초과 시 강조 표시
						</span>
					</label>
				</div>
			{/if}

			<!-- 반복 (Phase 3) -->
			<div class="border dark:border-gray-700 rounded-lg p-4 opacity-50">
				<h3 class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
					<Repeat class="w-4 h-4" />
					반복 (Phase 3에서 활성화)
				</h3>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
					반복 설정은 Phase 3에서 구현됩니다
				</p>
			</div>

			<!-- 그룹 (Phase 4) -->
			<div class="border dark:border-gray-700 rounded-lg p-4 opacity-50">
				<h3 class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
					<Folder class="w-4 h-4" />
					그룹 (Phase 4에서 활성화)
				</h3>
				<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
					그룹 설정은 Phase 4에서 구현됩니다
				</p>
			</div>

			<!-- 태그 -->
			<div>
				<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
					태그
				</label>
				<div class="flex flex-wrap gap-2 mb-2">
					{#each tags as tag}
						<span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
							{tag}
							<button
								type="button"
								onclick={() => removeTag(tag)}
								class="hover:text-blue-900 dark:hover:text-blue-100"
							>
								✕
							</button>
						</span>
					{/each}
				</div>
				<input
					type="text"
					bind:value={tagInput}
					onkeydown={handleKeydown}
					placeholder="태그를 입력하고 Enter"
					class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
				/>
			</div>

			<!-- 액션 버튼 -->
			<div class="flex gap-3 pt-4">
				<button
					type="button"
					onclick={onClose}
					class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
				>
					취소
				</button>
				<button
					type="submit"
					class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
				>
					{isEdit ? '저장' : '생성'}
				</button>
			</div>
		</form>
	</div>
</div>
