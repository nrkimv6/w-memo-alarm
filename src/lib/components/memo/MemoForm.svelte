<script lang="ts">
	import { onMount } from 'svelte';
	import { X, Plus, Link, ListChecks, Sparkles, ArrowRightLeft, Lock, LockOpen } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmojiPicker from './EmojiPicker.svelte';
	import ReminderSettings from './ReminderSettings.svelte';
	import FolderSelector from './FolderSelector.svelte';
	import ChecklistEditor from './ChecklistEditor.svelte';
	import VoiceInput from './VoiceInput.svelte';
	import ImageAttachment from './ImageAttachment.svelte';
	import AudioRecorder from './AudioRecorder.svelte';
	import type { Memo, ChecklistItem, Reminder } from '$lib/types/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { suggestTags } from '$lib/utils/ai';
	import { hasPinSet } from '$lib/utils/memoPinLock';
	import { cn } from '$lib/utils';
	import PinLockModal from './PinLockModal.svelte';

	function generateReminderId(): string {
		return `rem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	interface Props {
		open: boolean;
		memo?: Memo | null;
		onClose: () => void;
	}

	let { open = $bindable(false), memo = null, onClose }: Props = $props();

	let title = $state('');
	let content = $state('');
	let tags = $state<string[]>([]);
	let tagInput = $state('');
	let url = $state('');
	let emoji = $state('🔗');
	let showUrlInput = $state(false);
	let reminders = $state<Reminder[]>([]);
	let folderId = $state<string | undefined>(undefined);
	let checklist = $state<ChecklistItem[]>([]);
	let showChecklist = $state(false);
	let images = $state<string[]>([]);
	let isLocked = $state(false);
	let lockHint = $state('');
	let showPinSetup = $state(false);
	let audioUrls = $state<string[]>([]);

	// Phase 15: AI 태그 추천
	let suggestedTags = $state<string[]>([]);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function updateTagSuggestions() {
		if (title.trim() || content.trim()) {
			const suggestions = suggestTags({ title, content, url }, tags);
			suggestedTags = suggestions.filter(s => !tags.includes(s));
		} else {
			suggestedTags = [];
		}
	}

	// 제목/내용 변경 시 300ms debounce로 자동 태그 제안
	$effect(() => {
		title;
		content;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(updateTagSuggestions, 300);
		return () => { if (debounceTimer) clearTimeout(debounceTimer); };
	});

	function addSuggestedTag(tag: string) {
		if (!tags.includes(tag)) {
			tags = [...tags, tag];
			suggestedTags = suggestedTags.filter(t => t !== tag);
		}
	}

	// 제목/내용/URL 중 하나라도 있으면 저장 가능
	const canSave = $derived(title.trim() || content.trim() || url.trim());

	// Ctrl+S 저장 단축키
	$effect(() => {
		if (!open) return;

		function handleKeydown(e: KeyboardEvent) {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				if (canSave) {
					handleSubmit();
				}
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	// 메모에서 알림 목록 가져오기 (하위 호환성)
	function getRemindersFromMemo(m: Memo): Reminder[] {
		if (m.reminders && m.reminders.length > 0) {
			return m.reminders.map(r => ({ ...r }));
		}
		if (m.reminder) {
			return [{
				...m.reminder,
				id: m.reminder.id || generateReminderId()
			}];
		}
		return [];
	}

	// 편집 모드일 때 기존 데이터 로드
	$effect(() => {
		if (open && memo) {
			title = memo.title;
			content = memo.content;
			tags = [...(memo.tags ?? [])];
			url = memo.url || '';
			emoji = memo.emoji || '🔗';
			showUrlInput = !!memo.url;
			reminders = getRemindersFromMemo(memo);
			folderId = memo.folderId;
			checklist = memo.checklist ? [...memo.checklist] : [];
			showChecklist = (memo.checklist?.length || 0) > 0;
			images = memo.images ? [...memo.images] : [];
			isLocked = memo.isLocked ?? false;
			lockHint = memo.lockHint ?? '';
			audioUrls = memo.audioUrls ? [...memo.audioUrls] : [];
		} else if (open && !memo) {
			title = '';
			content = '';
			tags = [];
			url = '';
			emoji = '🔗';
			showUrlInput = false;
			folderId = undefined;
			checklist = [];
			showChecklist = false;
			images = [];
			isLocked = false;
			lockHint = '';
			audioUrls = [];
			// Apply default reminder settings if autoReminderOnCreate is enabled
			if (settingsStore.settings.autoReminderOnCreate) {
				const defaultReminderSettings = settingsStore.getDefaultReminder();
				reminders = [{
					id: generateReminderId(),
					enabled: defaultReminderSettings.enabled,
					time: defaultReminderSettings.time,
					days: [...defaultReminderSettings.days],
					autoOpen: defaultReminderSettings.autoOpen,
					type: 'repeat',
					isDefault: true
				}];
			} else {
				reminders = [];
			}
		}
	});

	function addTag() {
		const trimmed = tagInput.trim();
		if (trimmed && !tags.includes(trimmed)) {
			tags = [...tags, trimmed];
		}
		tagInput = '';
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}

	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag();
		}
	}

	function getDomain(urlStr: string): string {
		try {
			return new URL(urlStr).hostname.replace('www.', '');
		} catch {
			return urlStr;
		}
	}

	async function handleSubmit() {
		// 제목/내용/URL 중 하나라도 있어야 저장 가능
		if (!canSave) return;

		// 제목이 비어있고 URL만 있는 경우 도메인을 제목으로 사용
		let finalTitle = title.trim();
		if (!finalTitle && url.trim()) {
			finalTitle = getDomain(url.trim());
		} else if (!finalTitle && content.trim()) {
			// 제목이 비어있고 내용만 있는 경우 내용의 첫 줄을 제목으로 사용
			finalTitle = content.trim().split('\n')[0].slice(0, 50);
		}

		const data = {
			title: finalTitle,
			content: content.trim(),
			tags,
			url: url.trim() || undefined,
			emoji: url.trim() ? emoji : undefined,
			reminders: reminders.length > 0 ? reminders : undefined,
			folderId,
			checklist: checklist.length > 0 ? checklist : undefined,
			images: images.length > 0 ? images : undefined,
			audioUrls: audioUrls.length > 0 ? audioUrls : undefined,
			isLocked: isLocked || undefined,
			lockHint: isLocked && lockHint.trim() ? lockHint.trim() : undefined
		};

		const isEdit = !!memo;
		// 먼저 모달 닫기 (낙관적 UI)
		handleClose();

		if (isEdit) {
			const result = await memosStore.update(memo.id, data);
			if (result) {
				toastStore.success('메모가 수정되었습니다');
			}
			// 실패 시 토스트는 memosStore.update() 내부에서 처리
		} else {
			const result = await memosStore.add(data);
			if (result) {
				toastStore.success('메모가 저장되었습니다');
			}
		}
	}

	function handleClose() {
		title = '';
		content = '';
		tags = [];
		tagInput = '';
		url = '';
		emoji = '🔗';
		showUrlInput = false;
		reminders = [];
		folderId = undefined;
		checklist = [];
		showChecklist = false;
		images = [];
		onClose();
	}

	async function handleConvertToTodo() {
		if (!memo) return;

		// 먼저 현재 변경사항 저장
		await handleSubmit();

		// 할일로 전환
		await memosStore.convertMemoToTodo(memo.id);

		handleClose();
	}
</script>

<Modal bind:open title={memo ? '메모 수정' : '새 메모'}>
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
		<div class="space-y-2">
			<label for="memo-title" class="text-sm font-medium">제목</label>
			<Input
				id="memo-title"
				placeholder="메모 제목을 입력하세요 (선택)"
				bind:value={title}
			/>
		</div>

		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<label for="memo-content" class="text-sm font-medium">내용</label>
				<VoiceInput onTranscript={(text) => {
					content = content ? content + ' ' + text : text;
				}} />
			</div>
			<Textarea
				id="memo-content"
				placeholder="내용을 입력하세요..."
				bind:value={content}
				class="min-h-[120px]"
			/>
		</div>

		<!-- URL 입력 (북마크) -->
		<div class="space-y-2">
			{#if showUrlInput}
				<label for="memo-url" class="text-sm font-medium">URL (북마크)</label>
				<div class="flex gap-2">
					<EmojiPicker {emoji} onSelect={(e) => emoji = e} />
					<Input
						id="memo-url"
						type="url"
						placeholder="https://..."
						bind:value={url}
						class="flex-1"
					/>
					<Button type="button" variant="ghost" size="icon" onclick={() => { showUrlInput = false; url = ''; }}>
						<X class="w-4 h-4" />
					</Button>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => showUrlInput = true}
					class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<Link class="w-4 h-4" />
					URL 추가 (북마크)
				</button>
			{/if}
		</div>

		<!-- 폴더 선택 -->
		{#if foldersStore.folders.length > 0 || folderId}
			<div class="space-y-2">
				<label class="text-sm font-medium">폴더</label>
				<FolderSelector selectedFolderId={folderId} onSelect={(id) => folderId = id} />
			</div>
		{/if}

		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<label for="memo-tags" class="text-sm font-medium">태그</label>
				<button
					type="button"
					onclick={updateTagSuggestions}
					class="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
					title="AI 태그 추천"
				>
					<Sparkles class="w-3 h-3" />
					추천
				</button>
			</div>
			<div class="flex gap-2">
				<Input
					id="memo-tags"
					placeholder="태그 입력 후 Enter"
					bind:value={tagInput}
					onkeydown={handleTagKeydown}
					class="flex-1"
				/>
				<Button type="button" variant="secondary" size="icon" onclick={addTag}>
					<Plus class="w-4 h-4" />
				</Button>
			</div>
			{#if suggestedTags.length > 0}
				<div class="flex flex-wrap gap-2 mt-2">
					<span class="text-xs text-muted-foreground">추천:</span>
					{#each suggestedTags as tag}
						<button
							type="button"
							onclick={() => addSuggestedTag(tag)}
							class="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
						>
							+ {tag}
						</button>
					{/each}
				</div>
			{/if}
			{#if tags.length > 0}
				<div class="flex flex-wrap gap-2 mt-2">
					{#each tags as tag}
						<Badge variant="sketchy" class="pr-1">
							{tag}
							<button
								type="button"
								onclick={() => removeTag(tag)}
								class="ml-1 p-0.5 hover:bg-black/10 rounded-full"
							>
								<X class="w-3 h-3" />
							</button>
						</Badge>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 체크리스트 -->
		{#if showChecklist}
			<ChecklistEditor
				items={checklist}
				onItemsChange={(items) => checklist = items}
			/>
		{:else}
			<button
				type="button"
				onclick={() => showChecklist = true}
				class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ListChecks class="w-4 h-4" />
				체크리스트 추가
			</button>
		{/if}

		<!-- 이미지 첨부 -->
		<ImageAttachment {images} onImagesChange={(imgs) => images = imgs} />

		<!-- 오디오 녹음 -->
		<AudioRecorder {audioUrls} onAudioChange={(a) => audioUrls = a} />

		<!-- 알림 설정 -->
		<ReminderSettings {reminders} onRemindersChange={(r) => reminders = r} />

		<!-- 잠금 설정 (PIN이 설정된 경우만 표시) -->
		{#if hasPinSet()}
			<div class="border border-border rounded-lg p-3 space-y-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						{#if isLocked}
							<Lock class="w-4 h-4 text-primary" />
						{:else}
							<LockOpen class="w-4 h-4 text-muted-foreground" />
						{/if}
						<span class="text-sm">메모 잠금</span>
					</div>
					<button
						type="button"
						role="switch"
						aria-checked={isLocked}
						onclick={() => (isLocked = !isLocked)}
						class={cn('toggle-switch', isLocked && 'active')}
					>
						<span class="toggle-switch-thumb"></span>
					</button>
				</div>
				{#if isLocked}
					<input
						type="text"
						placeholder="힌트 (선택 사항)"
						bind:value={lockHint}
						class="w-full px-2 py-1.5 text-sm border border-input bg-background rounded focus:outline-none focus:ring-1 focus:ring-ring"
					/>
				{/if}
			</div>
		{/if}
	</form>

	<PinLockModal
		bind:open={showPinSetup}
		mode="setup"
		onSuccess={() => (showPinSetup = false)}
		onClose={() => (showPinSetup = false)}
	/>

	{#snippet footer()}
		<div class="flex items-center justify-between w-full">
			<div>
				{#if memo && memo.memoType !== 'todo'}
					<Button variant="outline" size="sm" onclick={handleConvertToTodo}>
						<ArrowRightLeft class="w-4 h-4 mr-1" />
						할일로 전환
					</Button>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="ghost" onclick={handleClose}>취소</Button>
				<Button onclick={handleSubmit} disabled={!canSave}>
					{memo ? '수정' : '저장'}
				</Button>
			</div>
		</div>
	{/snippet}
</Modal>
