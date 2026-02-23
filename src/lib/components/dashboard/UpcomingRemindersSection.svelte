<script lang="ts">
	import { Bell, ChevronRight } from 'lucide-svelte';
	import type { Memo } from '$lib/types/memo';

	interface Props {
		reminders: Memo[];
		onView: (memo: Memo) => void;
		onShowAll: () => void;
		formatReminderTime: (datetime: string) => string;
	}

	const { reminders, onView, onShowAll, formatReminderTime }: Props = $props();
</script>

<section>
	<div class="flex items-center justify-between mb-3">
		<h2 class="text-base font-semibold flex items-center gap-2">
			<Bell class="w-4 h-4 text-orange-500" />
			알림 예정
		</h2>
		<button
			onclick={onShowAll}
			class="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
		>
			더보기 <ChevronRight class="w-4 h-4" />
		</button>
	</div>
	<div class="space-y-2">
		{#each reminders as memo (memo.id)}
			<button
				onclick={() => onView(memo)}
				class="w-full flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors text-left"
			>
				<div class="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
					<Bell class="w-5 h-5 text-orange-500" />
				</div>
				<div class="flex-1 min-w-0">
					<p class="font-medium truncate">{memo.title || '제목 없음'}</p>
					<p class="text-sm text-muted-foreground">
						{formatReminderTime(memo.reminder!.datetime!)}
					</p>
				</div>
				<ChevronRight class="w-4 h-4 text-muted-foreground shrink-0" />
			</button>
		{/each}
	</div>
</section>
