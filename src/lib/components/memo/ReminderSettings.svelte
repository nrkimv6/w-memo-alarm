<script lang="ts">
	import { Bell, Plus, X } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ReminderCard from './ReminderCard.svelte';
	import { cn } from '$lib/utils';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import type { Reminder } from '$lib/types/memo';

	interface Props {
		reminders: Reminder[];
		onRemindersChange: (reminders: Reminder[]) => void;
	}

	let { reminders = [], onRemindersChange }: Props = $props();

	const defaultSettings = settingsStore.getDefaultReminder();

	// 기본 알림
	let defaultReminder = $derived(reminders.find(r => r.isDefault));

	// 추가 알림
	let additionalReminders = $derived(reminders.filter(r => !r.isDefault));

	// 알림이 하나도 없을 때 표시할 버튼
	let showAddButton = $derived(reminders.length === 0);

	function generateReminderId(): string {
		return `rem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	function getTomorrowDate(): string {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return tomorrow.toISOString().split('T')[0];
	}

	// 기본 알림 추가
	function addDefaultReminder() {
		const newReminder: Reminder = {
			id: generateReminderId(),
			enabled: true,
			time: defaultSettings.time,
			days: [...defaultSettings.days],
			autoOpen: defaultSettings.autoOpen,
			type: 'repeat',
			isDefault: true
		};
		onRemindersChange([newReminder, ...reminders]);
	}

	// 추가 알림 추가
	function addReminder() {
		const newReminder: Reminder = {
			id: generateReminderId(),
			enabled: true,
			time: '09:00',
			days: [1, 2, 3, 4, 5],
			autoOpen: false,
			type: 'repeat',
			isDefault: false
		};
		onRemindersChange([...reminders, newReminder]);
	}

	// 알림 수정
	function updateReminder(id: string, changes: Partial<Reminder>) {
		const updated = reminders.map(r =>
			r.id === id ? { ...r, ...changes } : r
		);
		onRemindersChange(updated);
	}

	// 알림 삭제
	function removeReminder(id: string) {
		const filtered = reminders.filter(r => r.id !== id);
		onRemindersChange(filtered);
	}

	// 모든 알림 제거
	function removeAllReminders() {
		onRemindersChange([]);
	}
</script>

<div class="space-y-3">
	{#if showAddButton}
		<!-- 알림이 없을 때 -->
		<button
			type="button"
			onclick={addDefaultReminder}
			class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
		>
			<Bell class="w-4 h-4" />
			알림 추가
		</button>
	{:else}
		<!-- 알림 설정 헤더 -->
		<div class="flex items-center justify-between">
			<span class="text-sm font-medium flex items-center gap-2">
				<Bell class="w-4 h-4" />
				알림 설정 ({reminders.length})
			</span>
			<Button type="button" variant="ghost" size="sm" onclick={removeAllReminders}>
				<X class="w-4 h-4" />
			</Button>
		</div>

		<div class="space-y-3">
			<!-- 기본 알림 섹션 -->
			{#if defaultReminder}
				<div class="space-y-2">
					<span class="text-xs text-muted-foreground font-medium">기본 알림</span>
					<ReminderCard
						reminder={defaultReminder}
						isDefault={true}
						onUpdate={(changes) => updateReminder(defaultReminder!.id, changes)}
						onDelete={() => removeReminder(defaultReminder!.id)}
					/>
				</div>
			{:else}
				<button
					type="button"
					onclick={addDefaultReminder}
					class="w-full py-2 px-3 border border-dashed border-primary/50 rounded-lg text-sm text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
				>
					<Plus class="w-4 h-4" />
					기본 알림 추가
				</button>
			{/if}

			<!-- 추가 알림 섹션 -->
			{#if additionalReminders.length > 0}
				<div class="space-y-2">
					<span class="text-xs text-muted-foreground font-medium">추가 알림 ({additionalReminders.length})</span>
					{#each additionalReminders as reminder (reminder.id)}
						<ReminderCard
							{reminder}
							isDefault={false}
							onUpdate={(changes) => updateReminder(reminder.id, changes)}
							onDelete={() => removeReminder(reminder.id)}
						/>
					{/each}
				</div>
			{/if}

			<!-- 알림 추가 버튼 -->
			<button
				type="button"
				onclick={addReminder}
				class="w-full py-2 px-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-2"
			>
				<Plus class="w-4 h-4" />
				알림 추가
			</button>
		</div>
	{/if}
</div>
