<script lang="ts">
	import { Clock, Trash2, ChevronDown, ChevronUp, Calendar, Repeat } from 'lucide-svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import { cn } from '$lib/utils';
	import type { Reminder } from '$lib/types/memo';

	interface Props {
		reminder: Reminder;
		isDefault?: boolean;
		onUpdate: (changes: Partial<Reminder>) => void;
		onDelete?: () => void;
		disabled?: boolean;
	}

	let { reminder, isDefault = false, onUpdate, onDelete, disabled = false }: Props = $props();

	let expanded = $state(false);

	const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

	function getTodayDate(): string {
		return new Date().toISOString().split('T')[0];
	}

	function formatDays(days: number[]): string {
		if (days.length === 7) return '매일';
		if (days.length === 5 && !days.includes(0) && !days.includes(6)) return '평일';
		if (days.length === 2 && days.includes(0) && days.includes(6)) return '주말';
		return days.map(d => dayLabels[d]).join(', ');
	}

	function toggleDay(day: number) {
		const currentDays = reminder.days || [];
		let newDays: number[];
		if (currentDays.includes(day)) {
			newDays = currentDays.filter((d) => d !== day);
		} else {
			newDays = [...currentDays, day].sort();
		}
		onUpdate({ days: newDays });
	}
</script>

<div class={cn(
	"border rounded-lg overflow-hidden transition-all",
	!reminder.enabled && "opacity-60",
	isDefault ? "border-primary/50 bg-primary/5" : "border-border"
)}>
	<!-- 카드 헤더 -->
	<div class="flex items-center justify-between p-3 bg-muted/30">
		<div class="flex items-center gap-3">
			<Clock class="w-4 h-4 text-muted-foreground" />
			<div class="flex flex-col">
				<div class="flex items-center gap-2">
					<span class="font-medium">{reminder.time}</span>
					{#if isDefault}
						<span class="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">기본</span>
					{/if}
					<span class={cn(
						"text-xs px-1.5 py-0.5 rounded",
						reminder.type === 'once'
							? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
							: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
					)}>
						{reminder.type === 'once' ? '1회' : '반복'}
					</span>
				</div>
				<span class="text-xs text-muted-foreground">
					{#if reminder.type === 'once' && reminder.date}
						{reminder.date}
					{:else if reminder.days && reminder.days.length > 0}
						{formatDays(reminder.days)}
					{:else}
						요일 미선택
					{/if}
				</span>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<Toggle
				checked={reminder.enabled}
				onchange={(e: Event) => onUpdate({ enabled: (e.target as HTMLInputElement).checked })}
				{disabled}
			/>
			<button
				type="button"
				onclick={() => expanded = !expanded}
				class="p-1.5 rounded hover:bg-muted transition-colors"
				{disabled}
			>
				{#if expanded}
					<ChevronUp class="w-4 h-4" />
				{:else}
					<ChevronDown class="w-4 h-4" />
				{/if}
			</button>
			{#if !isDefault && onDelete}
				<button
					type="button"
					onclick={onDelete}
					class="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
					{disabled}
				>
					<Trash2 class="w-4 h-4" />
				</button>
			{/if}
		</div>
	</div>

	<!-- 확장된 설정 -->
	{#if expanded}
		<div class="p-3 space-y-4 border-t border-border">
			<!-- 알림 타입 선택 -->
			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => onUpdate({ type: 'repeat' })}
					disabled={disabled || isDefault}
					class={cn(
						'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
						reminder.type !== 'once'
							? 'bg-primary text-primary-foreground'
							: 'bg-background border border-border hover:bg-muted',
						(disabled || isDefault) && 'opacity-50 cursor-not-allowed'
					)}
				>
					<Repeat class="w-4 h-4" />
					반복
				</button>
				<button
					type="button"
					onclick={() => onUpdate({ type: 'once' })}
					disabled={disabled || isDefault}
					class={cn(
						'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
						reminder.type === 'once'
							? 'bg-primary text-primary-foreground'
							: 'bg-background border border-border hover:bg-muted',
						(disabled || isDefault) && 'opacity-50 cursor-not-allowed'
					)}
				>
					<Calendar class="w-4 h-4" />
					1회
				</button>
			</div>

			<!-- 시간 설정 -->
			<div class="space-y-2">
				<label for="reminder-time-{reminder.id}" class="text-sm">알림 시간</label>
				<input
					id="reminder-time-{reminder.id}"
					type="time"
					value={reminder.time}
					onchange={(e: Event) => onUpdate({ time: (e.target as HTMLInputElement).value })}
					disabled={disabled || isDefault}
					class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
				/>
			</div>

			{#if reminder.type === 'once'}
				<!-- 날짜 선택 (1회성) -->
				<div class="space-y-2">
					<label for="reminder-date-{reminder.id}" class="text-sm">알림 날짜</label>
					<input
						id="reminder-date-{reminder.id}"
						type="date"
						value={reminder.date || ''}
						onchange={(e: Event) => onUpdate({ date: (e.target as HTMLInputElement).value })}
						min={getTodayDate()}
						disabled={disabled}
						class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
					/>
				</div>
			{:else}
				<!-- 요일 선택 (반복) -->
				<div class="space-y-2">
					<span class="text-sm">반복 요일</span>
					<div class="flex gap-1">
						{#each dayLabels as label, i}
							<button
								type="button"
								onclick={() => toggleDay(i)}
								disabled={disabled || isDefault}
								class={cn(
									'w-8 h-8 rounded-full text-xs font-medium transition-colors',
									(reminder.days || []).includes(i)
										? 'bg-primary text-primary-foreground'
										: 'bg-background border border-border hover:bg-muted',
									(disabled || isDefault) && 'opacity-50 cursor-not-allowed'
								)}
							>
								{label}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- URL 자동 열기 -->
			<div class="flex items-center justify-between">
				<span class="text-sm">URL 자동 열기</span>
				<Toggle
					checked={reminder.autoOpen}
					onchange={(e: Event) => onUpdate({ autoOpen: (e.target as HTMLInputElement).checked })}
					{disabled}
				/>
			</div>
		</div>
	{/if}
</div>
