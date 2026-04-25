<script lang="ts">
	import { memosStore } from "$lib/stores/memos.svelte";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import { foldersStore } from "$lib/stores/folders.svelte";
	import type {
		Memo,
		TodoPriority,
		TodoTiming,
		TodoRemindEntry,
		TodoAlertEntry,
		Recurrence,
		TodoUrl,
	} from "$lib/types/memo";
	import {
		Calendar,
		Repeat,
		FolderOpen,
		ArrowRightLeft,
		Plus,
		Link2,
		Trash2,
	} from "lucide-svelte";
	import FutureSchedules from "./FutureSchedules.svelte";
	import DueAlarmSection from "./DueAlarmSection.svelte";
	import RepeatingAlarmSection from "../shared/RepeatingAlarmSection.svelte";

	interface Props {
		memo?: Memo;
		onClose: () => void;
		onSave?: (memo: Memo) => void;
	}

	type DueAlarmSectionChanges = {
		alertTimes?: TodoAlertEntry[];
		useGlobalAutoAlert?: boolean;
		showOverdue?: boolean;
		autoPung?: boolean;
		pungDelay?: number;
	};

	let { memo, onClose, onSave }: Props = $props();

	const isEdit = !!memo;

	// Form state
	let title = $state(memo?.title || "");
	let content = $state(memo?.content || "");
	let tags = $state<string[]>(memo?.tags || []);
	let todoPriority = $state<TodoPriority>(memo?.todoPriority || "medium");
	let dueDate = $state(memo?.dueDate || "");
	let dueTime = $state(memo?.dueTime || "");
	let allDay = $state(memo?.dueTime === "23:59" || false);

	// Folder state
	let selectedFolderId = $state(memo?.folderId || "");

	// TodoTiming state
	let useGlobalRemind = $state(memo?.todoTiming?.useGlobalRemind ?? true);
	let useGlobalAutoAlert = $state(
		memo?.todoTiming?.useGlobalAutoAlert ?? true,
	);
	let autoAlertBefore = $state(memo?.todoTiming?.autoAlertBefore);
	let showOverdue = $state(memo?.todoTiming?.showOverdue ?? true);
	let remindTimes = $state<TodoRemindEntry[]>(
		memo?.todoTiming?.remindTimes || [],
	);
	let alertTimes = $state<TodoAlertEntry[]>(
		memo?.todoTiming?.alertTimes || [],
	);

	// Recurrence state
	let recurrenceType = $state<
		"none" | "daily" | "weekly" | "monthly" | "custom"
	>(memo?.recurrence ? memo.recurrence.type : "none");
	let recurrenceInterval = $state(memo?.recurrence?.interval || 1);
	let recurrenceDaysOfWeek = $state<number[]>(
		memo?.recurrence?.daysOfWeek || [],
	);
	let recurrenceDayOfMonth = $state(memo?.recurrence?.dayOfMonth || 1);
	let recurrenceCustomInterval = $state(
		memo?.recurrence?.customInterval || 1,
	);
	let recurrenceCustomUnit = $state<"day" | "week" | "month">(
		memo?.recurrence?.customUnit || "day",
	);
	let recurrenceEndType = $state<"none" | "date" | "count">(
		memo?.recurrence?.endDate
			? "date"
			: memo?.recurrence?.endAfter
				? "count"
				: "none",
	);
	let recurrenceEndDate = $state(memo?.recurrence?.endDate || "");
	let recurrenceEndAfter = $state(memo?.recurrence?.endAfter || 1);

	// UI state
	let tagInput = $state("");

	// Todo URL state
	let todoUrls = $state<TodoUrl[]>(memo?.todoUrls || []);
	let showAddUrl = $state(false);
	let newUrl = $state("");
	let newUrlLabel = $state("");

	// Pung state
	let autoPung = $state(memo?.autoPung || false);
	let pungDelay = $state(memo?.pungDelay || 0);

	// Computed
	const globalRemindTime = $derived(
		settingsStore.settings.todoDefaults.remind.time,
	);
	const globalAutoAlertMinutes = $derived(
		settingsStore.settings.todoDefaults.autoAlert.minutesBefore,
	);
	const folders = $derived(foldersStore.getSorted());

	// Watch allDay toggle
	$effect(() => {
		if (allDay) {
			dueTime = "23:59";
		} else if (dueTime === "23:59") {
			dueTime = "";
		}
	});

	function generateId() {
		return `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
	}

	function addTodoUrl() {
		const trimmedUrl = newUrl.trim();
		if (!trimmedUrl) return;

		// URL 유효성 검증
		try {
			new URL(trimmedUrl);
		} catch {
			alert("올바른 URL을 입력해주세요 (http:// 또는 https://로 시작)");
			return;
		}

		const urlEntry: TodoUrl = {
			id: generateId(),
			url: trimmedUrl,
			label: newUrlLabel.trim() || undefined,
			addedAt: Date.now(),
		};

		todoUrls = [...todoUrls, urlEntry];
		newUrl = "";
		newUrlLabel = "";
		showAddUrl = false;
	}

	function removeTodoUrl(id: string) {
		todoUrls = todoUrls.filter((u) => u.id !== id);
	}

	function getDomain(url: string): string {
		try {
			return new URL(url).hostname.replace("www.", "");
		} catch {
			return url;
		}
	}

	function handlePriorityChange(priority: TodoPriority) {
		todoPriority = priority;
	}

	function addTag() {
		const trimmed = tagInput.trim();
		if (trimmed && !tags.includes(trimmed)) {
			tags = [...tags, trimmed];
			tagInput = "";
		}
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			addTag();
		}
	}

	function toggleDayOfWeek(day: number) {
		if (recurrenceDaysOfWeek.includes(day)) {
			recurrenceDaysOfWeek = recurrenceDaysOfWeek.filter(
				(d) => d !== day,
			);
		} else {
			recurrenceDaysOfWeek = [...recurrenceDaysOfWeek, day].sort();
		}
	}

	async function handleSubmit() {
		if (!title.trim()) {
			alert("제목을 입력해주세요");
			return;
		}

		const todoTiming: TodoTiming = {
			useGlobalRemind,
			remindTimes: useGlobalRemind ? [] : remindTimes,
			useGlobalAutoAlert,
			autoAlertBefore: useGlobalAutoAlert
				? globalAutoAlertMinutes
				: autoAlertBefore,
			alertTimes: alertTimes,
			showOverdue,
		};

		// Build recurrence object
		let recurrence: Recurrence | undefined = undefined;
		if (recurrenceType !== "none") {
			if (
				recurrenceType === "weekly" &&
				recurrenceDaysOfWeek.length === 0
			) {
				alert("반복 요일을 선택해주세요");
				return;
			}

			recurrence = {
				type: recurrenceType,
				interval: recurrenceType === "custom" ? 1 : recurrenceInterval,
				daysOfWeek:
					recurrenceType === "weekly"
						? recurrenceDaysOfWeek
						: undefined,
				dayOfMonth:
					recurrenceType === "monthly"
						? recurrenceDayOfMonth
						: undefined,
				customInterval:
					recurrenceType === "custom"
						? recurrenceCustomInterval
						: undefined,
				customUnit:
					recurrenceType === "custom"
						? recurrenceCustomUnit
						: undefined,
				endDate:
					recurrenceEndType === "date"
						? recurrenceEndDate
						: undefined,
				endAfter:
					recurrenceEndType === "count"
						? recurrenceEndAfter
						: undefined,
			} as Recurrence;
		}

		const memoData = {
			...(memo || {}),
			title: title.trim(),
			content: content.trim(),
			tags,
			memoType: "todo" as const,
			todoPriority,
			todoStatus: memo?.todoStatus || ("pending" as const),
			dueDate: dueDate || undefined,
			dueTime: allDay ? "23:59" : dueTime || undefined,
			todoTiming,
			recurrence,
			folderId: selectedFolderId || undefined,
			todoUrls: todoUrls.length > 0 ? todoUrls : undefined,
			autoPung,
			pungDelay,
		};

		if (isEdit && memo) {
			await memosStore.update(memo.id, memoData);
		} else {
			await memosStore.add({
				...memoData,
				id: "",
				createdAt: Date.now(),
				updatedAt: Date.now(),
				isPinned: false,
				isFavorite: false,
				isActive: true,
			} as Memo);
		}

		if (onSave) {
			onSave(memoData as Memo);
		}

		onClose();
	}

	async function handleConvertToMemo() {
		if (!memo) return;

		const extraUrlCount = todoUrls.length >= 2 ? todoUrls.length - 1 : 0;
		const urlWarning = extraUrlCount > 0
			? `\n\n🔗 URL 목록 중 첫 번째를 제외한 ${extraUrlCount}개 URL이 삭제됩니다.`
			: '';

		// 확인 다이얼로그
		const confirmed = confirm(
			'할일을 메모로 전환하시겠습니까?\n\n' +
			'⚠️ 주의: 기한, 우선순위, 반복 설정 등 할일 전용 정보가 삭제됩니다.' +
			urlWarning
		);

		if (!confirmed) return;

		// 먼저 현재 변경사항 저장
		await handleSubmit();

		// 메모로 전환
		await memosStore.convertTodoToMemo(memo.id);

		onClose();
	}

	// Helper for priority colors (visual only)
	function getPriorityClass(priority: string, isSelected: boolean) {
		const base =
			"flex-1 px-4 py-2 rounded-lg font-medium transition-colors";
		if (isSelected) {
			switch (priority) {
				case "low":
					return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 border border-blue-200 dark:border-blue-800`;
				case "medium":
					return `${base} bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200 border border-orange-200 dark:border-orange-800`;
				case "high":
					return `${base} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 border border-red-200 dark:border-red-800`;
				case "urgent":
					return `${base} bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-100 border border-red-300 dark:border-red-700`;
				default:
					return base;
			}
		}
		return `${base} bg-muted text-muted-foreground hover:bg-muted/80`;
	}
</script>

<div
	class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
>
	<div
		class="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-border"
	>
		<div
			class="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10"
		>
			<h2 class="text-xl font-semibold text-foreground">
				{isEdit ? "할일 수정" : "새 할일"}
			</h2>
			<button
				onclick={onClose}
				class="text-muted-foreground hover:text-foreground"
			>
				✕
			</button>
		</div>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="p-6 space-y-6"
		>
			<!-- 제목 -->
			<div>
				<label class="block text-sm font-medium text-foreground mb-2">
					제목 *
				</label>
				<input
					type="text"
					bind:value={title}
					placeholder="할일 제목을 입력하세요"
					class="sketchy-input w-full"
					required
				/>
			</div>

			<!-- 메모 -->
			<div>
				<label class="block text-sm font-medium text-foreground mb-2">
					메모
				</label>
				<textarea
					bind:value={content}
					placeholder="메모를 입력하세요 (선택사항)"
					rows="3"
					class="sketchy-input w-full resize-none"
				></textarea>
			</div>

			<!-- 우선순위 -->
			<div>
				<label class="block text-sm font-medium text-foreground mb-2">
					우선순위
				</label>
				<div class="flex gap-2">
					{#each [{ value: "low", label: "낮음" }, { value: "medium", label: "보통" }, { value: "high", label: "높음" }, { value: "urgent", label: "긴급" }] as priority}
						<button
							type="button"
							onclick={() =>
								handlePriorityChange(
									priority.value as TodoPriority,
								)}
							class={getPriorityClass(
								priority.value,
								todoPriority === priority.value,
							)}
						>
							{priority.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- 기한 -->
			<div class="space-y-3">
				<label class="block text-sm font-medium text-foreground">
					<Calendar class="inline w-4 h-4 mr-1" />
					기한
				</label>
				<div class="flex gap-3">
					<input
						type="date"
						bind:value={dueDate}
						class="sketchy-input flex-1"
					/>
					{#if !allDay}
						<input
							type="time"
							bind:value={dueTime}
							disabled={!dueDate}
							class="sketchy-input disabled:opacity-50 disabled:cursor-not-allowed"
						/>
					{/if}
				</div>
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={allDay}
						disabled={!dueDate}
						class="rounded border-border text-primary focus:ring-primary"
					/>
					<span class="text-sm text-muted-foreground">하루 종일</span>
				</label>
			</div>

			<div class="space-y-4">
				<RepeatingAlarmSection
					remindTimes={remindTimes}
					useGlobal={useGlobalRemind}
					globalTime={globalRemindTime}
					hasDueDate={!!dueDate}
					onUpdate={(
						nextRemindTimes: TodoRemindEntry[],
						nextUseGlobal: boolean,
					) => {
						remindTimes = nextRemindTimes;
						useGlobalRemind = nextUseGlobal;
					}}
				/>

				{#if dueDate}
					<DueAlarmSection
						{dueDate}
						{alertTimes}
						{useGlobalAutoAlert}
						{globalAutoAlertMinutes}
						{showOverdue}
						{autoPung}
						{pungDelay}
						onUpdate={(changes: DueAlarmSectionChanges) => {
							if (changes.alertTimes !== undefined) {
								alertTimes = changes.alertTimes;
							}
							if (changes.useGlobalAutoAlert !== undefined) {
								useGlobalAutoAlert =
									changes.useGlobalAutoAlert;
							}
							if (changes.showOverdue !== undefined) {
								showOverdue = changes.showOverdue;
							}
							if (changes.autoPung !== undefined) {
								autoPung = changes.autoPung;
							}
							if (changes.pungDelay !== undefined) {
								pungDelay = changes.pungDelay;
							}
						}}
					/>
				{/if}
			</div>

			<!-- 반복 -->
			<div
				class="border border-border rounded-lg p-4 space-y-4 bg-muted/20"
			>
				<h3 class="font-medium text-foreground flex items-center gap-2">
					<Repeat class="w-4 h-4" />
					반복
				</h3>

				<!-- 반복 타입 선택 -->
				<div>
					<label
						class="block text-sm font-medium text-foreground mb-2"
					>
						반복 유형
					</label>
					<select
						bind:value={recurrenceType}
						class="sketchy-input w-full"
					>
						<option value="none">반복 안 함</option>
						<option value="daily">매일</option>
						<option value="weekly">매주</option>
						<option value="monthly">매월</option>
						<option value="custom">사용자 지정</option>
					</select>
				</div>

				{#if recurrenceType !== "none"}
					<!-- 간격 설정 (daily/weekly/monthly) -->
					{#if recurrenceType === "daily" || recurrenceType === "weekly" || recurrenceType === "monthly"}
						<div>
							<label
								class="block text-sm font-medium text-foreground mb-2"
							>
								간격
							</label>
							<div class="flex items-center gap-2">
								<span class="text-sm text-muted-foreground"
									>매</span
								>
								<input
									type="number"
									bind:value={recurrenceInterval}
									min="1"
									class="sketchy-input w-20"
								/>
								<span class="text-sm text-muted-foreground">
									{recurrenceType === "daily"
										? "일"
										: recurrenceType === "weekly"
											? "주"
											: "월"}마다
								</span>
							</div>
						</div>
					{/if}

					<!-- 요일 선택 (weekly) -->
					{#if recurrenceType === "weekly"}
						<div>
							<label
								class="block text-sm font-medium text-foreground mb-2"
							>
								요일 선택 *
							</label>
							<div class="flex gap-2">
								{#each ["일", "월", "화", "수", "목", "금", "토"] as dayLabel, idx}
									<button
										type="button"
										onclick={() => toggleDayOfWeek(idx)}
										class="flex-1 px-2 py-2 rounded-lg font-medium transition-colors {recurrenceDaysOfWeek.includes(
											idx,
										)
											? 'bg-primary text-primary-foreground'
											: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
									>
										{dayLabel}
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<!-- 일자 선택 (monthly) -->
					{#if recurrenceType === "monthly"}
						<div>
							<label
								class="block text-sm font-medium text-foreground mb-2"
							>
								날짜
							</label>
							<div class="flex items-center gap-2">
								<span class="text-sm text-muted-foreground"
									>매월</span
								>
								<input
									type="number"
									bind:value={recurrenceDayOfMonth}
									min="1"
									max="31"
									class="sketchy-input w-20"
								/>
								<span class="text-sm text-muted-foreground"
									>일</span
								>
							</div>
						</div>
					{/if}

					<!-- 사용자 지정 간격 (custom) -->
					{#if recurrenceType === "custom"}
						<div>
							<label
								class="block text-sm font-medium text-foreground mb-2"
							>
								간격 설정
							</label>
							<div class="flex items-center gap-2">
								<span class="text-sm text-muted-foreground"
									>매</span
								>
								<input
									type="number"
									bind:value={recurrenceCustomInterval}
									min="1"
									class="sketchy-input w-20"
								/>
								<select
									bind:value={recurrenceCustomUnit}
									class="sketchy-input"
								>
									<option value="day">일</option>
									<option value="week">주</option>
									<option value="month">월</option>
								</select>
								<span class="text-sm text-muted-foreground"
									>마다</span
								>
							</div>
						</div>
					{/if}

					<!-- 반복 종료 조건 -->
					<div class="space-y-3">
						<label
							class="block text-sm font-medium text-foreground"
						>
							반복 종료
						</label>
						<div class="space-y-2">
							<label
								class="flex items-center gap-2 cursor-pointer"
							>
								<input
									type="radio"
									bind:group={recurrenceEndType}
									value="none"
									class="text-primary focus:ring-primary"
								/>
								<span class="text-sm text-foreground"
									>종료 없음 (무한 반복)</span
								>
							</label>

							<label
								class="flex items-center gap-2 cursor-pointer"
							>
								<input
									type="radio"
									bind:group={recurrenceEndType}
									value="date"
									class="text-primary focus:ring-primary"
								/>
								<span class="text-sm text-foreground"
									>날짜 지정</span
								>
							</label>
							{#if recurrenceEndType === "date"}
								<input
									type="date"
									bind:value={recurrenceEndDate}
									class="sketchy-input ml-6"
								/>
							{/if}

							<label
								class="flex items-center gap-2 cursor-pointer"
							>
								<input
									type="radio"
									bind:group={recurrenceEndType}
									value="count"
									class="text-primary focus:ring-primary"
								/>
								<span class="text-sm text-foreground"
									>횟수 지정</span
								>
							</label>
							{#if recurrenceEndType === "count"}
								<div class="ml-6 flex items-center gap-2">
									<input
										type="number"
										bind:value={recurrenceEndAfter}
										min="1"
										class="sketchy-input w-20"
									/>
									<span class="text-sm text-muted-foreground"
										>회 후 종료</span
									>
								</div>
							{/if}
						</div>
					</div>

					<!-- 미래 일정 미리보기 (편집 시에만 표시) -->
					{#if isEdit && memo?.recurrence && memo?.todoInstances}
						<FutureSchedules todo={memo} count={5} />
					{/if}
				{/if}
			</div>

			<!-- ============================================ -->
			<!-- URL 링크 -->
			<!-- ============================================ -->
			<div>
				<label class="block text-sm font-medium text-foreground mb-2">
					<Link2 class="inline w-4 h-4 mr-1" />
					관련 링크
				</label>

				{#if todoUrls.length > 0}
					<div class="space-y-2 mb-3">
						{#each todoUrls as urlEntry}
							<div
								class="flex items-center justify-between px-3 py-2 bg-card rounded-md border border-border/50"
							>
								<a
									href={urlEntry.url}
									target="_blank"
									rel="noopener noreferrer"
									class="flex-1 text-sm text-primary hover:underline truncate"
								>
									{urlEntry.label || getDomain(urlEntry.url)}
								</a>
								<button
									type="button"
									onclick={() => removeTodoUrl(urlEntry.id)}
									class="ml-2 text-muted-foreground hover:text-destructive transition-colors p-0.5"
								>
									<Trash2 class="w-3.5 h-3.5" />
								</button>
							</div>
						{/each}
					</div>
				{/if}

				{#if showAddUrl}
					<div class="space-y-2 p-3 bg-muted/20 rounded-md border border-border">
						<input
							type="url"
							bind:value={newUrl}
							placeholder="https://example.com"
							class="sketchy-input w-full"
						/>
						<input
							type="text"
							bind:value={newUrlLabel}
							placeholder="링크 이름 (선택사항)"
							class="sketchy-input w-full"
						/>
						<div class="flex gap-2">
							<button
								type="button"
								onclick={addTodoUrl}
								class="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
							>
								추가
							</button>
							<button
								type="button"
								onclick={() => {
									showAddUrl = false;
									newUrl = "";
									newUrlLabel = "";
								}}
								class="px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted"
							>
								취소
							</button>
						</div>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (showAddUrl = true)}
						class="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
					>
						<Plus class="w-4 h-4" />
						URL 추가
					</button>
				{/if}
			</div>

			<!-- 폴더 -->
			{#if folders.length > 0}
				<div>
					<label class="block text-sm font-medium text-foreground mb-2">
						<FolderOpen class="inline w-4 h-4 mr-1" />
						폴더
					</label>
					<select
						bind:value={selectedFolderId}
						class="sketchy-input w-full"
					>
						<option value="">폴더 없음</option>
						{#each folders as folder}
							<option value={folder.id}>
								{folder.icon ? folder.icon + " " : ""}{folder.name}
							</option>
						{/each}
					</select>
				</div>
			{/if}

			<!-- 태그 -->
			<div>
				<label class="block text-sm font-medium text-foreground mb-2">
					태그
				</label>
				<div class="flex flex-wrap gap-2 mb-2">
					{#each tags as tag}
						<span
							class="inline-flex items-center gap-1 px-3 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded-full text-sm"
						>
							{tag}
							<button
								type="button"
								onclick={() => removeTag(tag)}
								class="hover:text-secondary/80"
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
					class="sketchy-input w-full"
				/>
			</div>

			<!-- 액션 버튼 -->
			<div class="flex items-center justify-between pt-4">
				<div>
					{#if isEdit && memo}
						<button
							type="button"
							onclick={handleConvertToMemo}
							class="flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							<ArrowRightLeft class="w-4 h-4" />
							메모로 전환
						</button>
					{/if}
				</div>
				<div class="flex gap-3">
					<button
						type="button"
						onclick={onClose}
						class="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
					>
						취소
					</button>
					<button
						type="submit"
						class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium"
					>
						{isEdit ? "저장" : "생성"}
					</button>
				</div>
			</div>
		</form>
	</div>
</div>
