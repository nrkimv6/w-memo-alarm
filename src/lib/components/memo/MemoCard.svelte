<script lang="ts">
	import { Pin, Star, Edit3, Trash2, ExternalLink, Folder, EyeOff, Eye, CheckSquare, Check, MoreVertical, Link2, RefreshCw, AlertTriangle, CloudOff, Bell } from 'lucide-svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import KebabMenu from '$lib/components/memo/KebabMenu.svelte';
	import SwipeableCard from '$lib/components/memo/SwipeableCard.svelte';
	import type { Memo } from '$lib/types/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { cn, formatRelativeTime } from '$lib/utils';

	interface Props {
		memo: Memo;
		compact?: boolean;
		ultraCompact?: boolean;
		onClick?: (memo: Memo) => void;
		onEdit: (memo: Memo) => void;
		onDelete: (memo: Memo) => void;
		onTogglePin: (id: string) => void;
		onToggleFavorite: (id: string) => void;
		onToggleActive?: (id: string) => void;
	}

	let { memo, compact = false, ultraCompact = false, onClick, onEdit, onDelete, onTogglePin, onToggleFavorite, onToggleActive }: Props = $props();

	const isSelectionMode = $derived(selectionStore.isSelectionMode);
	const isSelected = $derived(selectionStore.isSelected(memo.id));

	const folder = $derived(memo.folderId ? foldersStore.getById(memo.folderId) : null);
	const isInactive = $derived(memo.isActive === false);
	const hasChecklist = $derived((memo.checklist?.length || 0) > 0);
	const checklistComplete = $derived(memo.checklist?.filter((i) => i.completed).length || 0);
	const checklistTotal = $derived(memo.checklist?.length || 0);
	const syncStatus = $derived(memo.syncStatus);
	const isLocalOnly = $derived(syncStatus === 'local-only');
	const isPending = $derived(syncStatus === 'pending');
	const isFailed = $derived(syncStatus === 'failed');

	function handleRetrySync(e: MouseEvent) {
		e.stopPropagation();
		const localId = memo.localId || memo.id;
		memosStore.retrySync(localId);
	}

	function getDomain(url: string): string {
		try {
			const parsed = new URL(url);
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
				return url;
			}
			return parsed.hostname.replace('www.', '');
		} catch {
			return url;
		}
	}

	function safeHref(url: string): string {
		try {
			const { protocol } = new URL(url);
			return protocol === 'http:' || protocol === 'https:' ? url : '#';
		} catch {
			return '#';
		}
	}

	function handleUrlClick(e: MouseEvent) {
		e.stopPropagation();
		memosStore.incrementOpenCount(memo.id);
	}

	function handleCardClick() {
		if (isSelectionMode) {
			selectionStore.toggleSelection(memo.id);
		} else {
			onClick?.(memo);
		}
	}
</script>

<SwipeableCard
	onSwipeLeft={() => onDelete(memo)}
	onSwipeRight={() => onTogglePin(memo.id)}
>
	<Card
		class={cn(
			'group relative cursor-pointer',
			memo.isPinned && 'memo-card-pinned',
			isInactive && 'opacity-50',
			ultraCompact && 'py-2 px-3',
			isSelectionMode && 'ring-2 ring-border',
			isSelected && 'ring-2 ring-primary bg-primary/5'
		)}
		onclick={handleCardClick}
	>
	<!-- Selection indicator -->
	{#if isSelectionMode}
		<div
			class={cn(
				'absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center z-20 transition-colors',
				isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted border-2 border-border'
			)}
		>
			{#if isSelected}
				<Check class="w-3.5 h-3.5" />
			{/if}
		</div>
	{/if}
	<!-- Pin/Favorite indicators -->
	{#if memo.isPinned && !ultraCompact}
		<div class="absolute -top-2 -right-2 w-7 h-7 bg-secondary rounded-full flex items-center justify-center shadow-md z-10">
			<Pin class="w-3.5 h-3.5 text-white fill-white" />
		</div>
	{/if}

	<!-- Ultra Compact Mode: Single row -->
	{#if ultraCompact}
		<div class="flex items-center gap-3">
			{#if isLocalOnly}
				<CloudOff class="w-4 h-4 text-blue-500 flex-shrink-0" title="로컬에 저장됨 - 동기화 대기" />
			{:else if isPending}
				<RefreshCw class="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" title="동기화 중..." />
			{:else if isFailed}
				<button
					onclick={handleRetrySync}
					class="flex-shrink-0 p-0.5 rounded hover:bg-destructive/10 transition-colors"
					title="동기화 실패 - 탭하여 재시도"
				>
					<AlertTriangle class="w-4 h-4 text-destructive" />
				</button>
			{:else if memo.isPinned}
				<Pin class="w-4 h-4 text-secondary flex-shrink-0" />
			{/if}
			<h3 class="text-sm font-medium text-foreground truncate flex-1">
				{memo.title || '제목 없음'}
			</h3>
			{#if memo.url}
				<a
					href={safeHref(memo.url)}
					target="_blank"
					rel="noopener noreferrer"
					onclick={handleUrlClick}
					class="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
					title={getDomain(memo.url)}
				>
					<Link2 class="w-4 h-4 text-link" />
				</a>
			{/if}
			{#if memo.tags.length > 0}
				<span class="text-sm text-muted-foreground truncate max-w-[100px]">
					#{memo.tags[0]}
				</span>
			{/if}
			<time class="text-sm text-muted-foreground flex-shrink-0">
				{formatRelativeTime(memo.updatedAt)}
			</time>
			{#if memo.isFavorite}
				<Star class="w-4 h-4 text-warning fill-warning flex-shrink-0" />
			{/if}
		</div>
	{:else}
		<!-- Header -->
		<header class="flex items-start justify-between gap-3 mb-2">
			<div class="flex items-center gap-2 flex-1 min-w-0">
				{#if isLocalOnly}
					<CloudOff class="w-4 h-4 text-blue-500 flex-shrink-0" title="로컬에 저장됨 - 동기화 대기" />
				{:else if isPending}
					<RefreshCw class="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" title="동기화 중..." />
				{:else if isFailed}
					<button
						onclick={handleRetrySync}
						class="flex-shrink-0 p-1 rounded hover:bg-destructive/10 transition-colors"
						title="동기화 실패 - 탭하여 재시도"
					>
						<AlertTriangle class="w-4 h-4 text-destructive" />
					</button>
				{/if}
				<h3 class={cn('font-semibold text-foreground flex-1 min-w-0', compact ? 'text-base line-clamp-1' : 'text-lg line-clamp-2')}>
					{memo.title || '제목 없음'}
				</h3>
			</div>

		<!-- Hover actions -->
		<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
			<button
				onclick={(e) => { e.stopPropagation(); onTogglePin(memo.id); }}
				class={cn(
					'flex min-h-11 min-w-11 items-center justify-center rounded-md transition-colors',
					memo.isPinned ? 'text-secondary' : 'text-muted-foreground hover:text-secondary'
				)}
				title={memo.isPinned ? '고정 해제' : '고정'}
			>
				<Pin class={cn('w-5 h-5', memo.isPinned && 'fill-current')} />
			</button>
			<KebabMenu
				isInactive={isInactive}
				hasToggleActive={!!onToggleActive}
				onEdit={() => onEdit(memo)}
				onDelete={() => onDelete(memo)}
				onToggleActive={onToggleActive ? () => onToggleActive(memo.id) : undefined}
			/>
		</div>
	</header>

	<!-- Content -->
	{#if !compact && memo.content}
		<p class="text-muted-foreground text-sm line-clamp-3 mb-3">
			{memo.content}
		</p>
	{/if}

	<!-- URL (북마크) -->
	{#if memo.url}
		<div class="flex items-center gap-2 text-sm mb-3">
			{#if memo.emoji && memo.emoji !== '🔗'}
				<span>{memo.emoji}</span>
			{:else}
				<Link2 class="w-4 h-4 text-link flex-shrink-0" />
			{/if}
			<a
				href={safeHref(memo.url)}
				target="_blank"
				rel="noopener noreferrer"
				onclick={handleUrlClick}
				class="sketchy-link text-link truncate flex-1 hover:underline"
			>
				{getDomain(memo.url)}
			</a>
			{#if memo.openCount}
				<span class="text-sm text-muted-foreground">({memo.openCount}회)</span>
			{/if}
			<ExternalLink class="w-4 h-4 text-muted-foreground" />
		</div>
	{/if}

	<!-- Tags -->
	{#if memo.tags.length > 0}
		<div class="flex flex-wrap gap-1.5 mb-3">
			{#each memo.tags.slice(0, compact ? 2 : 4) as tag}
				<Badge variant="sketchy" class="text-xs">{tag}</Badge>
			{/each}
			{#if memo.tags.length > (compact ? 2 : 4)}
				<Badge variant="default" class="text-xs opacity-60">
					+{memo.tags.length - (compact ? 2 : 4)}
				</Badge>
			{/if}
		</div>
	{/if}

	<!-- Checklist progress -->
	{#if hasChecklist}
		<div class="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
			<CheckSquare class="w-4 h-4" />
			<div class="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
				<div
					class="h-full bg-primary transition-all duration-300"
					style="width: {checklistTotal > 0 ? Math.round((checklistComplete / checklistTotal) * 100) : 0}%"
				></div>
			</div>
			<span>{checklistComplete}/{checklistTotal}</span>
		</div>
	{/if}

	<!-- Footer -->
	<footer class="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t border-border/50">
		<div class="flex items-center gap-2">
			<time>{formatRelativeTime(memo.updatedAt)}</time>
			{#if memo.isFavorite && !memo.isPinned}
				<Star class="w-4 h-4 text-warning fill-warning" />
			{/if}
			{#if memo.reminder?.enabled}
				<div class="flex items-center gap-1 text-xs" title={memo.reminder.isDefault ? '기본알림 사용' : '사용자 지정'}>
					<Bell class="w-3.5 h-3.5" />
					{#if memo.reminder.isDefault}
						<span class="text-primary">기본</span>
					{:else}
						<span>{memo.reminder.time}</span>
					{/if}
				</div>
			{/if}
		</div>
		{#if folder}
			<div class="flex items-center gap-1">
				<span
					class="w-2 h-2 rounded-full"
					style="background-color: {folder.color}"
				></span>
				<span class="truncate max-w-[80px]">{folder.name}</span>
			</div>
		{/if}
	</footer>
	{/if}
	</Card>
</SwipeableCard>
