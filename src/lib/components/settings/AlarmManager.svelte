<script lang="ts">
	import { Bell, BellOff, Clock, Edit2 } from 'lucide-svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import { alarmManagerStore } from '$lib/stores/alarmManager.svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { cn } from '$lib/utils';

	const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

	// 초기화: 메모 로드 후 그룹 데이터 새로고침
	$effect(() => {
		if (memosStore.initialized && !memosStore.loading) {
			alarmManagerStore.refresh();
		}
	});

	// 요일 포맷팅
	function formatDays(days: number[] | undefined): string {
		if (!days || days.length === 0) return '요일 없음';
		if (days.length === 7) return '매일';
		if (days.length === 5 && !days.includes(0) && !days.includes(6)) return '평일';
		if (days.length === 2 && days.includes(0) && days.includes(6)) return '주말';
		return days.map(d => dayLabels[d]).join(', ');
	}

	// 메모 편집 모달 열기
	function openMemoEdit(memoId: string) {
		window.dispatchEvent(new CustomEvent('open-memo-edit', { detail: { memoId } }));
	}

	// 시간대 토글
	async function handleTimeSlotToggle(time: string, event: Event) {
		const target = event.target as HTMLInputElement;
		await alarmManagerStore.toggleTimeSlot(time, target.checked);
	}
</script>

<div class="alarm-manager">
	<header class="manager-header">
		<div>
			<h2 class="text-lg font-semibold flex items-center gap-2">
				<Bell class="w-5 h-5" />
				알림 관리
			</h2>
			<p class="text-sm text-muted-foreground mt-1">
				시간대별로 알림을 관리합니다
			</p>
		</div>
		{#if alarmManagerStore.totalCount > 0}
			<button
				class="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
				onclick={() => alarmManagerStore.disableAll()}
				disabled={alarmManagerStore.loading}
			>
				<BellOff class="w-4 h-4 inline-block mr-1" />
				모두 비활성화
			</button>
		{/if}
	</header>

	{#if alarmManagerStore.loading}
		<div class="text-center py-8 text-muted-foreground">
			처리 중...
		</div>
	{/if}

	{#if alarmManagerStore.groups.length === 0}
		<div class="empty-state text-center py-12">
			<Bell class="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
			<p class="text-muted-foreground">설정된 알림이 없습니다</p>
			<p class="text-sm text-muted-foreground/70 mt-2">
				메모에서 알림을 추가해보세요
			</p>
		</div>
	{:else}
		<div class="alarm-groups space-y-4 mt-6">
			{#each alarmManagerStore.groups as group (group.time)}
				<div class={cn(
					"alarm-group border rounded-lg overflow-hidden transition-all",
					!group.enabled && "opacity-60"
				)}>
					<!-- 시간대 헤더 -->
					<div class="group-header flex items-center justify-between p-4 bg-muted/30 border-b">
						<div class="flex items-center gap-3">
							<Clock class="w-5 h-5 text-muted-foreground" />
							<div>
								<span class="text-xl font-semibold">{group.time}</span>
								<span class="text-sm text-muted-foreground ml-2">
									{group.items.length}개 알림
								</span>
							</div>
						</div>
						<Toggle
							checked={group.enabled}
							onchange={(e: Event) => handleTimeSlotToggle(group.time, e)}
							disabled={alarmManagerStore.loading}
						/>
					</div>

					<!-- 해당 시간의 알림 목록 -->
					<div class="reminder-list">
						{#each group.items as item (item.reminderId)}
							<div class="reminder-item flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/20 transition-colors">
								<div class="memo-info flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-medium truncate">{item.memoTitle}</span>
									</div>
									<div class="flex items-center gap-2 mt-1">
										<span class={cn(
											"text-xs px-1.5 py-0.5 rounded",
											item.type === 'once'
												? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
												: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
										)}>
											{item.type === 'once' ? '1회' : '반복'}
										</span>
										{#if item.type === 'repeat' && item.days}
											<span class="text-xs text-muted-foreground">
												{formatDays(item.days)}
											</span>
										{:else if item.date}
											<span class="text-xs text-muted-foreground">
												{item.date}
											</span>
										{/if}
									</div>
								</div>
								<button
									class="edit-btn p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
									onclick={() => openMemoEdit(item.memoId)}
									title="메모 편집"
								>
									<Edit2 class="w-4 h-4" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.alarm-manager {
		padding: 1rem;
	}

	.manager-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	@media (max-width: 480px) {
		.manager-header {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
