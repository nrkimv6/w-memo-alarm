<script lang="ts">
	import { X, Plus, Link, ListChecks } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmojiPicker from './EmojiPicker.svelte';
	import ReminderSettings from './ReminderSettings.svelte';
	import FolderSelector from './FolderSelector.svelte';
	import ChecklistEditor from './ChecklistEditor.svelte';
	import type { Memo, ChecklistItem } from '$lib/types/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';

	type Reminder = NonNullable<Memo['reminder']>;

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
	let reminder = $state<Reminder | undefined>(undefined);
	let folderId = $state<string | undefined>(undefined);
	let checklist = $state<ChecklistItem[]>([]);
	let showChecklist = $state(false);

	// 편집 모드일 때 기존 데이터 로드
	$effect(() => {
		if (open && memo) {
			title = memo.title;
			content = memo.content;
			tags = [...memo.tags];
			url = memo.url || '';
			emoji = memo.emoji || '🔗';
			showUrlInput = !!memo.url;
			reminder = memo.reminder ? { ...memo.reminder } : undefined;
			folderId = memo.folderId;
			checklist = memo.checklist ? [...memo.checklist] : [];
			showChecklist = (memo.checklist?.length || 0) > 0;
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
			// Apply default reminder settings if autoReminderOnCreate is enabled
			if (settingsStore.settings.autoReminderOnCreate) {
				const defaultReminder = settingsStore.getDefaultReminder();
				reminder = { ...defaultReminder };
			} else {
				reminder = undefined;
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

	function handleSubmit() {
		if (!title.trim()) return;

		const data = {
			title: title.trim(),
			content: content.trim(),
			tags,
			url: url.trim() || undefined,
			emoji: url.trim() ? emoji : undefined,
			reminder,
			folderId,
			checklist: checklist.length > 0 ? checklist : undefined
		};

		const isEdit = !!memo;
		if (isEdit) {
			memosStore.update(memo.id, data);
			toastStore.success('메모가 수정되었습니다');
		} else {
			memosStore.add(data);
			toastStore.success('메모가 저장되었습니다');
		}

		handleClose();
	}

	function handleClose() {
		title = '';
		content = '';
		tags = [];
		tagInput = '';
		url = '';
		emoji = '🔗';
		showUrlInput = false;
		reminder = undefined;
		folderId = undefined;
		checklist = [];
		showChecklist = false;
		onClose();
	}
</script>

<Modal bind:open title={memo ? '메모 수정' : '새 메모'}>
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
		<div class="space-y-2">
			<label for="memo-title" class="text-sm font-medium">제목</label>
			<Input
				id="memo-title"
				placeholder="메모 제목을 입력하세요"
				bind:value={title}
				required
			/>
		</div>

		<div class="space-y-2">
			<label for="memo-content" class="text-sm font-medium">내용</label>
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
			<label for="memo-tags" class="text-sm font-medium">태그</label>
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

		<!-- 알림 설정 -->
		<ReminderSettings {reminder} onReminderChange={(r) => reminder = r} />
	</form>

	{#snippet footer()}
		<Button variant="ghost" onclick={handleClose}>취소</Button>
		<Button onclick={handleSubmit} disabled={!title.trim()}>
			{memo ? '수정' : '저장'}
		</Button>
	{/snippet}
</Modal>
