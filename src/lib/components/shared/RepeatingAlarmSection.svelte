<script lang="ts">
	import { Bell, Plus, X } from "lucide-svelte";
	import type { TodoRemindEntry } from "$lib/types/memo";
	import AlarmPresets from "./AlarmPresets.svelte";

	interface Props {
		remindTimes: TodoRemindEntry[];
		useGlobal: boolean;
		globalTime: string;
		hasDueDate?: boolean;
		onUpdate: (
			nextRemindTimes: TodoRemindEntry[],
			nextUseGlobal: boolean,
		) => void;
	}

	let {
		remindTimes,
		useGlobal,
		globalTime,
		hasDueDate = false,
		onUpdate,
	}: Props = $props();

	let showAddRemind = $state(false);
	let newRemindType = $state<"time" | "before_due">("time");
	let newRemindTime = $state("09:00");
	let newRemindMinutes = $state(60);

	const remindPresets = [
		{ label: "+ 1시간 전", minutes: 60 },
		{ label: "+ 3시간 전", minutes: 180 },
		{ label: "+ 하루 전", minutes: 1440 },
		{ label: "+ 3일 전", minutes: 4320 },
	];

	$effect(() => {
		if (!hasDueDate && newRemindType === "before_due") {
			newRemindType = "time";
		}
	});

	function generateId() {
		return `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
	}

	function formatMinutes(minutes: number): string {
		if (minutes < 60) return `${minutes}분 전`;
		if (minutes < 1440) {
			const h = Math.floor(minutes / 60);
			const m = minutes % 60;
			return m > 0 ? `${h}시간 ${m}분 전` : `${h}시간 전`;
		}
		const d = Math.floor(minutes / 1440);
		return `${d}일 전`;
	}

	function addRemindEntry() {
		const entry: TodoRemindEntry = {
			id: generateId(),
			type: newRemindType,
			time: newRemindType === "time" ? newRemindTime : undefined,
			minutesBefore:
				newRemindType === "before_due" ? newRemindMinutes : undefined,
		};

		onUpdate([...remindTimes, entry], useGlobal);
		showAddRemind = false;
	}

	function addRemindPreset(minutes: number) {
		const entry: TodoRemindEntry = {
			id: generateId(),
			type: "before_due",
			minutesBefore: minutes,
		};

		onUpdate([...remindTimes, entry], useGlobal);
	}

	function removeRemindEntry(id: string) {
		onUpdate(
			remindTimes.filter((remindEntry) => remindEntry.id !== id),
			useGlobal,
		);
	}
</script>

<div class="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
	<div>
		<p class="text-sm font-medium text-foreground flex items-center gap-1.5">
			<Bell class="w-4 h-4" />
			반복 알림
		</p>
		<p class="text-xs text-muted-foreground mt-0.5">
			잊지 않도록 정해진 시간에 반복해서 알려드려요
		</p>
	</div>

	<label class="flex items-center gap-2 cursor-pointer">
		<input
			type="checkbox"
			checked={useGlobal}
			onchange={(e: Event) =>
				onUpdate(
					remindTimes,
					(e.target as HTMLInputElement).checked,
				)}
			class="rounded border-border text-primary focus:ring-primary"
		/>
		<span class="text-sm text-foreground">
			앱 기본값 사용
			<span class="text-muted-foreground">(매일 {globalTime})</span>
		</span>
	</label>

	{#if !useGlobal}
		<div class="ml-1 space-y-2">
			{#if remindTimes.length > 0}
				<div class="space-y-1.5">
					{#each remindTimes as entry}
						<div
							class="flex items-center justify-between px-3 py-2 bg-card rounded-md border border-border/50"
						>
							<span class="text-sm text-foreground">
								{#if entry.type === "time"}
									매일 {entry.time} 알림
								{:else if entry.minutesBefore}
									기한 {formatMinutes(entry.minutesBefore)} 알림
								{/if}
							</span>
							<button
								type="button"
								onclick={() => removeRemindEntry(entry.id)}
								class="text-muted-foreground hover:text-destructive transition-colors p-0.5"
							>
								<X class="w-3.5 h-3.5" />
							</button>
						</div>
					{/each}
				</div>
			{/if}

			{#if hasDueDate}
				<AlarmPresets
					presets={remindPresets}
					onSelect={(preset) => {
						if (preset.minutes) {
							addRemindPreset(preset.minutes);
						}
					}}
				/>
			{/if}

			{#if showAddRemind}
				<div class="p-3 bg-card rounded-md border border-border space-y-3">
					<div class="flex gap-2 flex-wrap">
						<select
							bind:value={newRemindType}
							class="sketchy-input text-sm"
						>
							<option value="time">매일 특정 시간</option>
							{#if hasDueDate}
								<option value="before_due">기한 전</option>
							{/if}
						</select>
						{#if newRemindType === "time"}
							<input
								type="time"
								bind:value={newRemindTime}
								class="sketchy-input text-sm"
							/>
						{:else}
							<div class="flex items-center gap-1.5">
								<input
									type="number"
									bind:value={newRemindMinutes}
									min="1"
									class="sketchy-input w-20 text-sm"
								/>
								<span
									class="text-sm text-muted-foreground whitespace-nowrap"
								>
									분 전
								</span>
							</div>
						{/if}
					</div>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={addRemindEntry}
							class="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
						>
							추가
						</button>
						<button
							type="button"
							onclick={() => (showAddRemind = false)}
							class="px-3 py-1.5 text-sm border border-border rounded-md text-foreground hover:bg-muted"
						>
							취소
						</button>
					</div>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => (showAddRemind = true)}
					class="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
				>
					<Plus class="w-3.5 h-3.5" />
					직접 알림 추가
				</button>
			{/if}
		</div>
	{/if}
</div>
