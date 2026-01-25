<script lang="ts">
	import { Bell, X, Calendar, Repeat } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import { cn } from '$lib/utils';
	import { settingsStore } from '$lib/stores/settings.svelte';

	interface Reminder {
		enabled: boolean;
		time: string;
		days: number[];
		autoOpen: boolean;
		type?: 'repeat' | 'once';
		date?: string;
		isDefault?: boolean;
	}

	interface Props {
		reminder: Reminder | undefined;
		onReminderChange: (reminder: Reminder | undefined) => void;
	}

	let { reminder, onReminderChange }: Props = $props();

	// Use default settings from store when no reminder is provided
	const defaultReminder = settingsStore.getDefaultReminder();
	let showSettings = $state(false);
	let enabled = $state(true);
	let isDefault = $state(false);
	let time = $state(defaultReminder.time);
	let days = $state<number[]>([...defaultReminder.days]);
	let autoOpen = $state(defaultReminder.autoOpen);
	let reminderType = $state<'repeat' | 'once'>('repeat');
	let reminderDate = $state(getTomorrowDate());

	// reminder prop 변경 시 상태 업데이트
	$effect(() => {
		showSettings = !!reminder;
		enabled = reminder?.enabled ?? true;
		isDefault = reminder?.isDefault ?? false;
		time = reminder?.time ?? defaultReminder.time;
		days = reminder?.days ? [...reminder.days] : [...defaultReminder.days];
		autoOpen = reminder?.autoOpen ?? defaultReminder.autoOpen;
		reminderType = reminder?.type ?? 'repeat';
		reminderDate = reminder?.date ?? getTomorrowDate();
	});

	const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

	function getTomorrowDate(): string {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return tomorrow.toISOString().split('T')[0];
	}

	function getTodayDate(): string {
		return new Date().toISOString().split('T')[0];
	}

	// 기본알림 사용 시 기본 설정 적용
	$effect(() => {
		if (isDefault) {
			const defaultSettings = settingsStore.getDefaultReminder();
			time = defaultSettings.time;
			days = [...defaultSettings.days];
			autoOpen = defaultSettings.autoOpen;
		}
	});

	$effect(() => {
		if (showSettings) {
			if (reminderType === 'once') {
				onReminderChange({ enabled, time, days: [], autoOpen, type: 'once', date: reminderDate, isDefault });
			} else {
				onReminderChange({ enabled, time, days, autoOpen, type: 'repeat', isDefault });
			}
		} else {
			onReminderChange(undefined);
		}
	});

	function toggleDay(day: number) {
		if (days.includes(day)) {
			days = days.filter((d) => d !== day);
		} else {
			days = [...days, day].sort();
		}
	}

	function handleClose() {
		showSettings = false;
		onReminderChange(undefined);
	}
</script>

<div class="space-y-3">
	{#if showSettings}
		<div class="flex items-center justify-between">
			<span class="text-sm font-medium flex items-center gap-2">
				<Bell class="w-4 h-4" />
				알림 설정
			</span>
			<Button type="button" variant="ghost" size="sm" onclick={handleClose}>
				<X class="w-4 h-4" />
			</Button>
		</div>

		<div class="space-y-4 p-3 rounded-lg bg-muted/50 border border-border">
			<!-- 활성화 토글 -->
			<div class="flex items-center justify-between">
				<span class="text-sm">알림 활성화</span>
				<Toggle bind:checked={enabled} />
			</div>

			{#if enabled}
				<!-- 기본알림 사용 -->
				<div class="flex items-center justify-between p-2 rounded-lg bg-background/50">
					<div class="flex flex-col gap-1">
						<span class="text-sm font-medium">기본알림 사용</span>
						<span class="text-xs text-muted-foreground">
							{#if isDefault}
								{defaultReminder.time}, {dayLabels.filter((_, i) => defaultReminder.days.includes(i)).join('·')}
							{:else}
								사용자 지정 시간 설정
							{/if}
						</span>
					</div>
					<Toggle bind:checked={isDefault} />
				</div>

				<!-- 알림 타입 선택 -->
				<div class="flex gap-2">
					<button
						type="button"
						onclick={() => reminderType = 'repeat'}
						class={cn(
							'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
							reminderType === 'repeat'
								? 'bg-primary text-primary-foreground'
								: 'bg-background border border-border hover:bg-muted'
						)}
					>
						<Repeat class="w-4 h-4" />
						반복
					</button>
					<button
						type="button"
						onclick={() => reminderType = 'once'}
						class={cn(
							'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors',
							reminderType === 'once'
								? 'bg-primary text-primary-foreground'
								: 'bg-background border border-border hover:bg-muted'
						)}
					>
						<Calendar class="w-4 h-4" />
						1회
					</button>
				</div>

				<!-- 시간 설정 -->
				<div class="space-y-2">
					<label for="reminder-time" class="text-sm">알림 시간</label>
					<input
						id="reminder-time"
						type="time"
						bind:value={time}
						disabled={isDefault}
						class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
					/>
				</div>

				{#if reminderType === 'once'}
					<!-- 날짜 선택 (1회성) -->
					<div class="space-y-2">
						<label for="reminder-date" class="text-sm">알림 날짜</label>
						<input
							id="reminder-date"
							type="date"
							bind:value={reminderDate}
							min={getTodayDate()}
							class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
									disabled={isDefault}
									class={cn(
										'w-8 h-8 rounded-full text-xs font-medium transition-colors',
										days.includes(i)
											? 'bg-primary text-primary-foreground'
											: 'bg-background border border-border hover:bg-muted',
										isDefault && 'opacity-50 cursor-not-allowed'
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
					<Toggle bind:checked={autoOpen} />
				</div>
			{/if}
		</div>
	{:else}
		<button
			type="button"
			onclick={() => showSettings = true}
			class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
		>
			<Bell class="w-4 h-4" />
			알림 추가
		</button>
	{/if}
</div>
