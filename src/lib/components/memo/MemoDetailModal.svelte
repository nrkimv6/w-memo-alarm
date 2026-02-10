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
		ArrowRightLeft
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Memo } from '$lib/types/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { notificationHistoryStore } from '$lib/stores/notificationHistory.svelte';
	import { cn, formatRelativeTime, formatSmartDate } from '$lib/utils';

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
							<span class="text-xs">({memo.openHistory.length}회)</span>
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
