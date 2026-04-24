<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { X, Plus, Link, ListChecks, Sparkles, Share2, ArrowLeft, Save } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmojiPicker from '$lib/components/memo/EmojiPicker.svelte';
	import ReminderSettings from '$lib/components/memo/ReminderSettings.svelte';
	import FolderSelector from '$lib/components/memo/FolderSelector.svelte';
	import ChecklistEditor from '$lib/components/memo/ChecklistEditor.svelte';
	import type { Memo, ChecklistItem, Reminder } from '$lib/types/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { suggestTags } from '$lib/utils/ai';

	let { data } = $props();

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
	let isInitialized = $state(false);

	// AI 태그 추천
	let suggestedTags = $state<string[]>([]);

	function updateTagSuggestions() {
		if (title.trim() || content.trim()) {
			const suggestions = suggestTags({ title, content, url }, tags);
			suggestedTags = suggestions.filter((s) => !tags.includes(s));
		} else {
			suggestedTags = [];
		}
	}

	function addSuggestedTag(tag: string) {
		if (!tags.includes(tag)) {
			tags = [...tags, tag];
			suggestedTags = suggestedTags.filter((t) => t !== tag);
		}
	}

	// 제목/내용/URL 중 하나라도 있으면 저장 가능
	const canSave = $derived(title.trim() || content.trim() || url.trim());

	// 공유 데이터로 폼 초기화
	onMount(() => {
		if (data.hasData && data.defaults) {
			title = data.defaults.title || '';
			content = data.defaults.content || '';
			url = data.defaults.url || '';
			showUrlInput = !!data.defaults.url;

			// URL이 있으면 북마크 이모지 설정
			if (data.defaults.memoType === 'bookmark') {
				emoji = '🔖';
			}

			// 태그 추천 실행
			setTimeout(updateTagSuggestions, 100);
		}
		isInitialized = true;
	});

	// Ctrl+S 저장 단축키
	$effect(() => {
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
		if (!canSave) return;

		// 제목 자동 생성
		let finalTitle = title.trim();
		if (!finalTitle && url.trim()) {
			finalTitle = getDomain(url.trim());
		} else if (!finalTitle && content.trim()) {
			finalTitle = content.trim().split('\n')[0].slice(0, 50);
		}

		const memoData = {
			title: finalTitle,
			content: content.trim(),
			tags,
			url: url.trim() || undefined,
			emoji: url.trim() ? emoji : undefined,
			reminders: reminders.length > 0 ? reminders : undefined,
			folderId,
			checklist: checklist.length > 0 ? checklist : undefined,
			memoType: url.trim() ? 'bookmark' as const : 'note' as const
		};

		memosStore.add(memoData);
		toastStore.success('공유된 내용이 메모로 저장되었습니다');

		// 메모 목록으로 이동
		await goto('/memos');
	}

	function handleCancel() {
		// 이전 페이지로 가거나 홈으로
		if (window.history.length > 1) {
			window.history.back();
		} else {
			goto('/');
		}
	}
</script>

<svelte:head>
	<title>공유된 콘텐츠 저장 - 메모알람</title>
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- 헤더 -->
	<header class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
		<div class="container max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
			<button onclick={handleCancel} class="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors">
				<ArrowLeft class="w-5 h-5" />
			</button>
			<div class="flex items-center gap-2">
				<Share2 class="w-5 h-5 text-primary" />
				<h1 class="font-semibold">공유된 콘텐츠</h1>
			</div>
			<Button onclick={handleSubmit} disabled={!canSave} size="sm" class="gap-1">
				<Save class="w-4 h-4" />
				저장
			</Button>
		</div>
	</header>

	<!-- 메인 콘텐츠 -->
	<main class="container max-w-2xl mx-auto px-4 py-6">
		{#if !data.hasData && isInitialized}
			<!-- 공유 데이터가 없는 경우 -->
			<div class="text-center py-12">
				<Share2 class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
				<h2 class="text-lg font-medium mb-2">공유된 콘텐츠가 없습니다</h2>
				<p class="text-muted-foreground mb-6">
					다른 앱에서 콘텐츠를 공유하면 여기에 표시됩니다.
				</p>
				<Button onclick={() => goto('/')}>홈으로 이동</Button>
			</div>
		{:else}
			<!-- 공유 데이터 폼 -->
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-5">
				<!-- 공유 소스 표시 -->
				{#if data.raw?.url}
					<div class="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
						<Link class="w-4 h-4 text-primary flex-shrink-0" />
						<span class="text-sm text-muted-foreground truncate">{getDomain(data.raw.url)}</span>
						<Badge variant="sketchy" class="ml-auto flex-shrink-0">북마크</Badge>
					</div>
				{/if}

				<!-- 제목 -->
				<div class="space-y-2">
					<label for="share-title" class="text-sm font-medium">제목</label>
					<Input
						id="share-title"
						placeholder="메모 제목을 입력하세요 (선택)"
						bind:value={title}
					/>
				</div>

				<!-- 내용 -->
				<div class="space-y-2">
					<label for="share-content" class="text-sm font-medium">내용</label>
					<Textarea
						id="share-content"
						placeholder="내용을 입력하세요..."
						bind:value={content}
						class="min-h-[150px]"
					/>
				</div>

				<!-- URL 입력 (북마크) -->
				<div class="space-y-2">
					{#if showUrlInput}
						<label for="share-url" class="text-sm font-medium">URL (북마크)</label>
						<div class="flex gap-2">
							<EmojiPicker selected={emoji} onSelect={(e) => (emoji = e)} />
							<Input
								id="share-url"
								type="url"
								placeholder="https://..."
								bind:value={url}
								class="flex-1"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onclick={() => {
									showUrlInput = false;
									url = '';
								}}
							>
								<X class="w-4 h-4" />
							</Button>
						</div>
					{:else}
						<button
							type="button"
							onclick={() => (showUrlInput = true)}
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
						<FolderSelector selectedFolderId={folderId} onSelect={(id) => (folderId = id)} />
					</div>
				{/if}

				<!-- 태그 -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<label for="share-tags" class="text-sm font-medium">태그</label>
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
							id="share-tags"
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
					<ChecklistEditor items={checklist} onItemsChange={(items) => (checklist = items)} />
				{:else}
					<button
						type="button"
						onclick={() => (showChecklist = true)}
						class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						<ListChecks class="w-4 h-4" />
						체크리스트 추가
					</button>
				{/if}

				<!-- 알림 설정 -->
				<ReminderSettings {reminders} onRemindersChange={(r) => (reminders = r)} />

				<!-- 하단 버튼 -->
				<div class="flex gap-3 pt-4 border-t border-border">
					<Button type="button" variant="ghost" onclick={handleCancel} class="flex-1">
						취소
					</Button>
					<Button type="submit" disabled={!canSave} class="flex-1 gap-2">
						<Save class="w-4 h-4" />
						메모로 저장
					</Button>
				</div>
			</form>
		{/if}
	</main>
</div>
