<script lang="ts">
	import { Bell, BellOff, Calendar, Clock, Trash2 } from 'lucide-svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import type { Memo } from '$lib/types/memo';

	interface Props {
		open: boolean;
		onClose: () => void;
		onMemoClick?: (memo: Memo) => void;
	}

	let { open = $bindable(false), onClose, onMemoClick }: Props = $props();

	const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

	// Get all memos with reminders, sorted by time
	const memosWithReminders = $derived(
		memosStore.memos
			.filter((m) => m.reminder?.enabled)
			.sort((a, b) => {
				const timeA = a.reminder?.time || '00:00';
				const timeB = b.reminder?.time || '00:00';
				return timeA.localeCompare(timeB);
			})
	);

	function getDayLabels(days: number[]): string {
		if (days.length === 7) return '매일';
		if (days.length === 5 && days.every((d) => d >= 1 && d <= 5)) return '평일';
		if (days.length === 2 && days.includes(0) && days.includes(6)) return '주말';
		return days.map((d) => dayLabels[d]).join(', ');
	}

	function handleMemoClick(memo: Memo) {
		if (onMemoClick) {
			onMemoClick(memo);
			onClose();
		}
	}

	function handleDisableReminder(e: MouseEvent, memo: Memo) {
		e.stopPropagation();
		memosStore.update(memo.id, { reminder: { ...memo.reminder!, enabled: false } });
	}

	function handleDisableAll() {
		if (confirm('모든 알림을 비활성화하시겠습니까?')) {
			memosWithReminders.forEach((memo) => {
				if (memo.reminder) {
					memosStore.update(memo.id, { reminder: { ...memo.reminder, enabled: false } });
				}
			});
		}
	}
</script>

<Modal bind:open title="예정된 알림" size="md">
	<div class="space-y-4">
		{#if memosWithReminders.length === 0}
			<div class="flex flex-col items-center justify-center py-10 text-center">
				<div class="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
					<BellOff class="w-7 h-7 text-muted-foreground" />
				</div>
				<h3 class="text-lg font-medium mb-2">예정된 알림이 없습니다</h3>
				<p class="text-sm text-muted-foreground">메모에 알림을 설정하면 여기에 표시됩니다.</p>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">
				총 {memosWithReminders.length}개의 알림이 예정되어 있습니다.
			</p>

			<div class="space-y-2 max-h-[400px] overflow-y-auto">
				{#each memosWithReminders as memo (memo.id)}
					<button
						onclick={() => handleMemoClick(memo)}
						class="w-full flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
					>
						<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
							<Clock class="w-5 h-5 text-primary" />
						</div>
						<div class="flex-1 min-w-0">
							<h4 class="font-medium text-sm truncate">{memo.title || '제목 없음'}</h4>
							<div class="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
								<span class="font-medium text-foreground">{memo.reminder?.time}</span>
								<span>•</span>
								<span>{getDayLabels(memo.reminder?.days || [])}</span>
							</div>
						</div>
						<button
							onclick={(e) => handleDisableReminder(e, memo)}
							class="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
							title="알림 비활성화"
						>
							<BellOff class="w-4 h-4" />
						</button>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#snippet footer()}
		{#if memosWithReminders.length > 0}
			<Button variant="ghost" onclick={handleDisableAll} class="text-destructive hover:text-destructive">
				<BellOff class="w-4 h-4" />
				모두 비활성화
			</Button>
		{/if}
		<div class="flex-1"></div>
		<Button onclick={onClose}>닫기</Button>
	{/snippet}
</Modal>
