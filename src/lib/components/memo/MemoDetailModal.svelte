<script lang="ts">
	import {
		X,
		Edit3,
		Trash2,
		Share2,
		Pin,
		Star,
		ExternalLink,
		Clock,
		Calendar,
		Eye,
		Bell,
		Folder,
		Link2,
		ArrowRightLeft,
		Sparkles,
		ChevronDown,
		ChevronUp
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Memo } from '$lib/types/memo';
	import ImageAttachment from './ImageAttachment.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { notificationHistoryStore } from '$lib/stores/notificationHistory.svelte';
	import { cn, formatRelativeTime, formatSmartDate } from '$lib/utils';
	import { findRelatedMemos, generateSummary } from '$lib/utils/ai';

	interface Props {
		open: boolean;
		memo: Memo | null;
		onClose: () => void;
		onEdit: (memo: Memo) => void;
		onDelete: (memo: Memo) => void;
		onShare?: (memo: Memo) => void;
	}

	let { open = $bindable(false), memo, onClose, onEdit, onDelete, onShare }: Props = $props();

	const folder = $derived(memo?.folderId ? foldersStore.getById(memo.folderId) : null);

	// Phase 15: AI 기능
	const relatedMemos = $derived(
		memo ? findRelatedMemos(memo, memosStore.memos.filter(m => m.isActive !== false && m.memoType !== 'todo'), 3) : []
	);
	const contentSummary = $derived(
		memo && memo.content && memo.content.length > 150 ? generateSummary(memo.content, 80) : ''
	);

	// 관련 메모 섹션 상태
	let showRelated = $state(false);

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			weekday: 'short'
		});
	}

	function getDomain(url: string): string {
		try {
			return new URL(url).hostname.replace('www.', '');
		} catch {
			return url;
		}
	}

	function getDayLabel(day: number): string {
		const days = ['일', '월', '화', '수', '목', '금', '토'];
		return days[day];
	}

	function formatReminderSchedule(reminder: NonNullable<typeof memo>['reminder']): string {
		if (!reminder) return '';
		if (reminder.type === 'once' && reminder.date) {
			const date = new Date(reminder.date);
			const today = new Date();
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);

			if (reminder.date === today.toISOString().split('T')[0]) return '오늘';
			if (reminder.date === tomorrow.toISOString().split('T')[0]) return '내일';

			return date.toLocaleDateString('ko-KR', {
				month: 'short',
				day: 'numeric',
				weekday: 'short'
			});
		}
		return reminder.days.map(getDayLabel).join(', ');
	}

	function handleEdit() {
		if (memo) {
			onEdit(memo);
			onClose();
		}
	}

	function handleDelete() {
		if (memo) {
			onDelete(memo);
			onClose();
		}
	}

	function handleShare() {
		if (memo && onShare) {
			onShare(memo);
		}
	}

	async function handleConvertToTodo() {
		if (memo) {
			await memosStore.convertMemoToTodo(memo.id);
			onClose();
		}
	}

	function handleUrlClick() {
		if (memo) {
			memosStore.incrementOpenCount(memo.id);
			memosStore.addOpenHistory(memo.id);
		}
	}

	function handleTogglePin() {
		if (memo) {
			memosStore.togglePin(memo.id);
		}
	}

	function handleToggleFavorite() {
		if (memo) {
			memosStore.toggleFavorite(memo.id);
		}
	}
</script>

<Modal bind:open title="" size="lg">
	{#if memo}
		<div class="space-y-6">
			<!-- Header with actions -->
			<header class="flex items-start justify-between gap-4">
				<div class="flex-1">
					<h2 class="text-2xl font-bold text-foreground mb-2">
						{memo.title || '제목 없음'}
					</h2>
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Calendar class="w-4 h-4" />
						<span>{formatDate(memo.createdAt)}</span>
						<span class="text-muted-foreground/50">|</span>
						<span>수정: {formatRelativeTime(memo.updatedAt)}</span>
					</div>
				</div>

				<!-- Quick actions -->
				<div class="flex items-center gap-1">
					<button
						onclick={handleTogglePin}
						class={cn(
							'p-2 rounded-lg transition-colors',
							memo.isPinned ? 'text-secondary bg-secondary/10' : 'text-muted-foreground hover:text-secondary hover:bg-muted'
						)}
						title={memo.isPinned ? '고정 해제' : '고정'}
					>
						<Pin class={cn('w-5 h-5', memo.isPinned && 'fill-current')} />
					</button>
					<button
						onclick={handleToggleFavorite}
						class={cn(
							'p-2 rounded-lg transition-colors',
							memo.isFavorite ? 'text-warning bg-warning/10' : 'text-muted-foreground hover:text-warning hover:bg-muted'
						)}
						title={memo.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
					>
						<Star class={cn('w-5 h-5', memo.isFavorite && 'fill-current')} />
					</button>
				</div>
			</header>

			<!-- Content -->
			{#if memo.content}
				<div class="prose prose-sm max-w-none">
					<p class="text-foreground whitespace-pre-wrap leading-relaxed">
						{memo.content}
					</p>
				</div>
			{/if}

			<!-- Images -->
			{#if memo.images && memo.images.length > 0}
				<ImageAttachment images={memo.images} onImagesChange={() => {}} readonly={true} />
			{/if}

			<!-- URL -->
			{#if memo.url}
				<div class="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
					{#if memo.emoji && memo.emoji !== '🔗'}
						<span class="text-2xl">{memo.emoji}</span>
					{:else}
						<Link2 class="w-6 h-6 text-link flex-shrink-0" />
					{/if}
					<div class="flex-1 min-w-0">
						<a
							href={memo.url}
							target="_blank"
							rel="noopener noreferrer"
							onclick={handleUrlClick}
							class="text-link hover:underline font-medium block truncate"
						>
							{getDomain(memo.url)}
						</a>
						<p class="text-xs text-muted-foreground truncate">{memo.url}</p>
					</div>
					<div class="flex items-center gap-2 text-muted-foreground">
						{#if memo.openCount}
							<span class="text-xs flex items-center gap-1">
								<Eye class="w-3.5 h-3.5" />
								{memo.openCount}회
							</span>
						{/if}
						<ExternalLink class="w-4 h-4" />
					</div>
				</div>
			{/if}

			<!-- Tags -->
			{#if memo.tags.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each memo.tags as tag}
						<Badge variant="sketchy">{tag}</Badge>
					{/each}
				</div>
			{/if}

			<!-- AI: 메모 요약 (긴 내용일 때만 표시) -->
			{#if contentSummary}
				<div class="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
					<Sparkles class="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
					<div>
						<span class="text-xs text-primary font-medium">AI 요약</span>
						<p class="text-sm text-muted-foreground mt-0.5">{contentSummary}</p>
					</div>
				</div>
			{/if}

			<!-- AI: 관련 메모 추천 -->
			{#if relatedMemos.length > 0}
				<div class="border border-border rounded-lg overflow-hidden">
					<button
						onclick={() => showRelated = !showRelated}
						class="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
					>
						<span class="flex items-center gap-2">
							<Sparkles class="w-4 h-4 text-primary" />
							관련 메모 {relatedMemos.length}개
						</span>
						{#if showRelated}
							<ChevronUp class="w-4 h-4 text-muted-foreground" />
						{:else}
							<ChevronDown class="w-4 h-4 text-muted-foreground" />
						{/if}
					</button>
					{#if showRelated}
						<div class="border-t border-border divide-y divide-border">
							{#each relatedMemos as related}
								<div class="px-3 py-2 hover:bg-muted/30 transition-colors">
									<p class="text-sm font-medium text-foreground truncate">{related.title || '제목 없음'}</p>
									{#if related.content}
										<p class="text-xs text-muted-foreground truncate mt-0.5">{related.content}</p>
									{/if}
									{#if related.tags.length > 0}
										<div class="flex flex-wrap gap-1 mt-1">
											{#each related.tags.slice(0, 3) as tag}
												<span class="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">{tag}</span>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Meta info -->
			<div class="grid grid-cols-2 gap-4 text-sm">
				<!-- Folder -->
				{#if folder}
					<div class="flex items-center gap-2 text-muted-foreground">
						<Folder class="w-4 h-4" />
						<span
							class="w-3 h-3 rounded-full"
							style="background-color: {folder.color}"
						></span>
						<span>{folder.name}</span>
					</div>
				{/if}

				<!-- Reminder -->
				{#if memo.reminder?.enabled}
					<div class="flex items-center gap-2 text-muted-foreground">
						<Bell class="w-4 h-4" />
						<span>{memo.reminder.time}</span>
						<span class="text-xs">
							({formatReminderSchedule(memo.reminder)})
						</span>
						{#if memo.reminder.type === 'once'}
							<span class="px-1.5 py-0.5 rounded bg-secondary/20 text-secondary text-[10px] font-medium">1회</span>
						{/if}
					</div>
					{#if notificationHistoryStore.getByMemoId(memo.id).length > 0}
						<button
							onclick={() => { onClose(); goto(`/notifications?memoId=${memo.id}`); }}
							class="text-xs text-primary hover:underline ml-7"
						>
							발송내역 {notificationHistoryStore.getByMemoId(memo.id).length}건 보기
						</button>
					{/if}
				{/if}

				<!-- Open history -->
				{#if memo.openHistory && memo.openHistory.length > 0}
					<div class="flex items-center gap-2 text-muted-foreground col-span-2">
						<Clock class="w-4 h-4" />
						<span>최근 열람: {formatRelativeTime(memo.openHistory[0])}</span>
						{#if memo.openHistory.length > 1}
							<span class="text-xs">({memo.openHistory.length}회</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#snippet footer()}
		{#if onShare}
			<Button variant="ghost" onclick={handleShare}>
				<Share2 class="w-4 h-4" />
				공유
			</Button>
		{/if}
		{#if memo?.memoType !== 'todo'}
			<Button variant="ghost" onclick={handleConvertToTodo}>
				<ArrowRightLeft class="w-4 h-4" />
				할일로
			</Button>
		{/if}
		<div class="flex-1"></div>
		<Button variant="ghost" onclick={handleDelete} class="text-destructive hover:text-destructive">
			<Trash2 class="w-4 h-4" />
			삭제
		</Button>
		<Button onclick={handleEdit}>
			<Edit3 class="w-4 h-4" />
			수정
		</Button>
	{/snippet}
</Modal>
