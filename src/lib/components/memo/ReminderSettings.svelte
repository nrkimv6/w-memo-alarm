<script lang="ts">
	import { Bell, X } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import { cn } from '$lib/utils';
	import { settingsStore } from '$lib/stores/settings.svelte';

	interface Reminder {
		enabled: boolean;
		time: string;
		days: number[];
		autoOpen: boolean;
	}

	interface Props {
		reminder: Reminder | undefined;
		onReminderChange: (reminder: Reminder | undefined) => void;
	}

	let { reminder, onReminderChange }: Props = $props();

	// Use default settings from store when no reminder is provided
	const defaultReminder = settingsStore.getDefaultReminder();
	let showSettings = $state(!!reminder);
	let enabled = $state(reminder?.enabled ?? true);
	let time = $state(reminder?.time ?? defaultReminder.time);
	let days = $state<number[]>(reminder?.days ?? [...defaultReminder.days]);
	let autoOpen = $state(reminder?.autoOpen ?? defaultReminder.autoOpen);

	const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

	$effect(() => {
		if (showSettings && enabled) {
			onReminderChange({ enabled, time, days, autoOpen });
		} else if (!showSettings) {
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
				<!-- 시간 설정 -->
				<div class="space-y-2">
					<label for="reminder-time" class="text-sm">알림 시간</label>
					<input
						id="reminder-time"
						type="time"
						bind:value={time}
						class="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>

				<!-- 요일 선택 -->
				<div class="space-y-2">
					<span class="text-sm">반복 요일</span>
					<div class="flex gap-1">
						{#each dayLabels as label, i}
							<button
								type="button"
								onclick={() => toggleDay(i)}
								class={cn(
									'w-8 h-8 rounded-full text-xs font-medium transition-colors',
									days.includes(i)
										? 'bg-primary text-primary-foreground'
										: 'bg-background border border-border hover:bg-muted'
								)}
							>
								{label}
							</button>
						{/each}
					</div>
				</div>

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
