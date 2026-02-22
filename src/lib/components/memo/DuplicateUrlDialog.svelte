<script lang="ts">
	import { Link2, Merge, X, ExternalLink, AlertCircle } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Memo } from '$lib/types/memo';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { findDuplicatesByUrl, mergeMemos } from '$lib/utils';
	import { formatRelativeTime } from '$lib/utils';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open = $bindable(false), onClose }: Props = $props();

	// 중복 URL 그룹 (reactive)
	const duplicateGroups = $derived.by(() => {
		const map = findDuplicatesByUrl();
		return Array.from(map.entries()).map(([url, memos]) => ({ url, memos }));
	});

	function getDomain(url: string): string {
		try {
			return new URL(url).hostname.replace('www.', '');
		} catch {
			return url;
		}
	}

	function handleMergeGroup(memos: Memo[]) {
		const ids = memos.map((m) => m.id);
		const merged = mergeMemos(ids);
		if (!merged) {
			toastStore.error('병합에 실패했습니다');
			return;
		}
		memosStore.add(merged);
		ids.forEach((id) => memosStore.remove(id));
		toastStore.success(`${ids.length}개의 북마크가 병합되었습니다`);
	}

	function handleDeleteDuplicate(id: string) {
		memosStore.remove(id);
		toastStore.success('중복 메모가 삭제되었습니다');
	}

	function handleClose() {
		open = false;
		onClose();
	}
</script>

<Modal bind:open title="중복 URL 감지" class="max-w-2xl">
	{#if duplicateGroups.length === 0}
		<div class="flex flex-col items-center justify-center py-8 text-center">
			<div class="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
				<Link2 class="w-6 h-6 text-success" />
			</div>
			<h3 class="font-semibold mb-1">중복 URL 없음</h3>
			<p class="text-sm text-muted-foreground">동일한 URL을 가진 메모가 없습니다.</p>
		</div>
	{:else}
		<div class="space-y-4">
			<div class="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
				<AlertCircle class="w-4 h-4 text-warning flex-shrink-0" />
				<p class="text-sm text-warning-foreground">
					<strong>{duplicateGroups.length}개</strong> URL에서 중복 북마크가 발견되었습니다.
					병합하거나 불필요한 항목을 삭제하세요.
				</p>
			</div>

			{#each duplicateGroups as group (group.url)}
				<div class="border border-border rounded-lg overflow-hidden">
					<!-- URL 헤더 -->
					<div class="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/50">
						<Link2 class="w-4 h-4 text-link flex-shrink-0" />
						<a
							href={group.url}
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm text-link hover:underline truncate flex-1"
						>
							{getDomain(group.url)}
						</a>
						<Badge variant="default" class="text-xs flex-shrink-0">
							{group.memos.length}개 중복
						</Badge>
						<Button
							variant="secondary"
							size="sm"
							onclick={() => handleMergeGroup(group.memos)}
							class="flex-shrink-0 gap-1"
						>
							<Merge class="w-3.5 h-3.5" />
							모두 병합
						</Button>
					</div>

					<!-- 메모 목록 -->
					<div class="divide-y divide-border/30">
						{#each group.memos as memo (memo.id)}
							<div class="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-foreground truncate">
										{memo.title || '제목 없음'}
									</p>
									{#if memo.content}
										<p class="text-xs text-muted-foreground truncate mt-0.5">
											{memo.content}
										</p>
									{/if}
									<div class="flex items-center gap-2 mt-1">
										<time class="text-xs text-muted-foreground">
											{formatRelativeTime(memo.updatedAt)}
										</time>
										{#if memo.tags.length > 0}
											<div class="flex gap-1">
												{#each memo.tags.slice(0, 2) as tag}
													<Badge variant="sketchy" class="text-xs py-0">{tag}</Badge>
												{/each}
											</div>
										{/if}
									</div>
								</div>
								<a
									href={group.url}
									target="_blank"
									rel="noopener noreferrer"
									class="p-1.5 rounded hover:bg-muted transition-colors flex-shrink-0"
									title="원본 열기"
								>
									<ExternalLink class="w-3.5 h-3.5 text-muted-foreground" />
								</a>
								<button
									onclick={() => handleDeleteDuplicate(memo.id)}
									class="p-1.5 rounded hover:bg-destructive/10 transition-colors flex-shrink-0"
									title="이 메모 삭제"
								>
									<X class="w-3.5 h-3.5 text-destructive" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#snippet footer()}
		<Button variant="ghost" onclick={handleClose}>닫기</Button>
	{/snippet}
</Modal>
