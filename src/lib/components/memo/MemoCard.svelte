<script lang="ts">
	import { Pin, Star, Edit3, Trash2, ExternalLink, Folder, EyeOff, Eye } from 'lucide-svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Memo } from '$lib/types/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { foldersStore } from '$lib/stores/folders.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		memo: Memo;
		compact?: boolean;
		onClick?: (memo: Memo) => void;
		onEdit: (memo: Memo) => void;
		onDelete: (memo: Memo) => void;
		onTogglePin: (id: string) => void;
		onToggleFavorite: (id: string) => void;
		onToggleActive?: (id: string) => void;
	}

	let { memo, compact = false, onClick, onEdit, onDelete, onTogglePin, onToggleFavorite, onToggleActive }: Props = $props();

	const folder = $derived(memo.folderId ? foldersStore.getById(memo.folderId) : null);
	const isInactive = $derived(memo.isActive === false);

	function formatRelativeTime(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return days === 1 ? '어제' : `${days}일 전`;
		if (hours > 0) return `${hours}시간 전`;
		if (minutes > 0) return `${minutes}분 전`;
		return '방금 전';
	}

	function getDomain(url: string): string {
		try {
			return new URL(url).hostname.replace('www.', '');
		} catch {
			return url;
		}
	}

	function handleUrlClick(e: MouseEvent) {
		e.stopPropagation();
		memosStore.incrementOpenCount(memo.id);
	}

	function handleCardClick() {
		onClick?.(memo);
	}
</script>

<Card
	class={cn('group relative cursor-pointer', memo.isPinned && 'memo-card-pinned', isInactive && 'opacity-50')}
	onclick={handleCardClick}
>
	<!-- Pin/Favorite indicators -->
	{#if memo.isPinned}
		<div class="absolute -top-2 -right-2 w-7 h-7 bg-secondary rounded-full flex items-center justify-center shadow-md z-10">
			<Pin class="w-3.5 h-3.5 text-white fill-white" />
		</div>
	{/if}

	<!-- Header -->
	<header class="flex items-start justify-between gap-3 mb-2">
		<h3 class={cn('font-semibold text-foreground', compact ? 'text-base line-clamp-1' : 'text-lg line-clamp-2')}>
			{memo.title || '제목 없음'}
		</h3>

		<!-- Hover actions -->
		<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
			<button
				onclick={() => onTogglePin(memo.id)}
				class={cn(
					'p-1.5 rounded-md transition-colors',
					memo.isPinned ? 'text-secondary' : 'text-muted-foreground hover:text-secondary'
				)}
				title={memo.isPinned ? '고정 해제' : '고정'}
			>
				<Pin class={cn('w-4 h-4', memo.isPinned && 'fill-current')} />
			</button>
			<button
				onclick={() => onToggleFavorite(memo.id)}
				class={cn(
					'p-1.5 rounded-md transition-colors',
					memo.isFavorite ? 'text-warning' : 'text-muted-foreground hover:text-warning'
				)}
				title={memo.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
			>
				<Star class={cn('w-4 h-4', memo.isFavorite && 'fill-current')} />
			</button>
			{#if onToggleActive}
				<button
					onclick={(e) => { e.stopPropagation(); onToggleActive(memo.id); }}
					class={cn(
						'p-1.5 rounded-md transition-colors',
						isInactive ? 'text-muted-foreground/50' : 'text-muted-foreground hover:text-foreground'
					)}
					title={isInactive ? '활성화' : '비활성화'}
				>
					{#if isInactive}
						<Eye class="w-4 h-4" />
					{:else}
						<EyeOff class="w-4 h-4" />
					{/if}
				</button>
			{/if}
			<button
				onclick={() => onEdit(memo)}
				class="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
				title="수정"
			>
				<Edit3 class="w-4 h-4" />
			</button>
			<button
				onclick={() => onDelete(memo)}
				class="p-1.5 rounded-md text-muted-foreground hover:text-destructive transition-colors"
				title="삭제"
			>
				<Trash2 class="w-4 h-4" />
			</button>
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
			<span>{memo.emoji || '🔗'}</span>
			<a
				href={memo.url}
				target="_blank"
				rel="noopener noreferrer"
				onclick={handleUrlClick}
				class="sketchy-link text-link truncate flex-1 hover:underline"
			>
				{getDomain(memo.url)}
			</a>
			{#if memo.openCount}
				<span class="text-xs text-muted-foreground">({memo.openCount}회)</span>
			{/if}
			<ExternalLink class="w-3.5 h-3.5 text-muted-foreground" />
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

	<!-- Footer -->
	<footer class="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
		<div class="flex items-center gap-2">
			<time>{formatRelativeTime(memo.updatedAt)}</time>
			{#if memo.isFavorite && !memo.isPinned}
				<Star class="w-3 h-3 text-warning fill-warning" />
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
</Card>
