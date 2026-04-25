<script lang="ts">
	import { BellRing, Plus, X } from "lucide-svelte";
	import type { TodoAlertEntry } from "$lib/types/memo";
	import AlarmPresets from "$lib/components/shared/AlarmPresets.svelte";

	interface DueAlarmSectionChanges {
		alertTimes?: TodoAlertEntry[];
		useGlobalAutoAlert?: boolean;
		showOverdue?: boolean;
		autoPung?: boolean;
		pungDelay?: number;
	}

	interface Props {
		dueDate: string;
		alertTimes: TodoAlertEntry[];
		useGlobalAutoAlert: boolean;
		globalAutoAlertMinutes: number;
		showOverdue: boolean;
		autoPung: boolean;
		pungDelay: number;
		onUpdate: (changes: DueAlarmSectionChanges) => void;
	}

	let {
		dueDate,
		alertTimes,
		useGlobalAutoAlert,
		globalAutoAlertMinutes,
		showOverdue,
		autoPung,
		pungDelay,
		onUpdate,
	}: Props = $props();

	let showAddAlert = $state(false);
	let newAlertType = $state<"datetime" | "before_due">("before_due");
	let newAlertDate = $state(dueDate);
	let newAlertTime = $state("12:00");
	let newAlertMinutes = $state(30);

	const alertPresets = [
		{ label: "+ 30분 전", minutes: 30 },
		{ label: "+ 1시간 전", minutes: 60 },
		{ label: "+ 3시간 전", minutes: 180 },
		{ label: "+ 하루 전", minutes: 1440 },
	];

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

	function addAlertEntry() {
		const entry: TodoAlertEntry = {
			id: generateId(),
			type: newAlertType,
			date:
				newAlertType === "datetime"
					? newAlertDate || dueDate
					: undefined,
			time: newAlertType === "datetime" ? newAlertTime : undefined,
			minutesBefore:
				newAlertType === "before_due" ? newAlertMinutes : undefined,
		};

		onUpdate({ alertTimes: [...alertTimes, entry] });
		showAddAlert = false;
	}

	function addAlertPreset(minutes: number) {
		const entry: TodoAlertEntry = {
			id: generateId(),
			type: "before_due",
			minutesBefore: minutes,
		};

		onUpdate({ alertTimes: [...alertTimes, entry] });
	}

	function removeAlertEntry(id: string) {
		onUpdate({
			alertTimes: alertTimes.filter((alertEntry) => alertEntry.id !== id),
		});
	}
</script>

<div class="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
	<div>
		<p class="text-sm font-medium text-foreground flex items-center gap-1.5">
			<BellRing class="w-4 h-4" />
			기한 알림
		</p>
		<p class="text-xs text-muted-foreground mt-0.5">
			기한이 다가오거나 지난 뒤의 상태를 한 곳에서 관리해요
		</p>
	</div>

	<label class="flex items-center gap-2 cursor-pointer">
		<input
			type="checkbox"
			checked={useGlobalAutoAlert}
			onchange={(e: Event) =>
				onUpdate({
					useGlobalAutoAlert: (e.target as HTMLInputElement).checked,
				})}
			class="rounded border-border text-primary focus:ring-primary"
		/>
		<span class="text-sm text-foreground">
			앱 기본값 사용
			<span class="text-muted-foreground">
				(기한 {formatMinutes(globalAutoAlertMinutes)})
			</span>
		</span>
	</label>

	<div class="ml-1 space-y-2">
		{#if alertTimes.length > 0}
			<div class="space-y-1.5">
				{#each alertTimes as entry}
					<div
						class="flex items-center justify-between px-3 py-2 bg-card rounded-md border border-border/50"
					>
						<span class="text-sm text-foreground">
							{#if entry.type === "datetime" && entry.date && entry.time}
								{entry.date} {entry.time} 알림
							{:else if entry.minutesBefore}
								기한 {formatMinutes(entry.minutesBefore)} 알림
							{/if}
						</span>
						<button
							type="button"
							onclick={() => removeAlertEntry(entry.id)}
							class="text-muted-foreground hover:text-destructive transition-colors p-0.5"
						>
							<X class="w-3.5 h-3.5" />
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<AlarmPresets
			presets={alertPresets}
			variant="warning"
			onSelect={(preset) => {
				if (preset.minutes) {
					addAlertPreset(preset.minutes);
				}
			}}
		/>

		{#if showAddAlert}
			<div class="p-3 bg-card rounded-md border border-border space-y-3">
				<div class="flex gap-2 flex-wrap">
					<select
						bind:value={newAlertType}
						class="sketchy-input text-sm"
					>
						<option value="before_due">기한 전</option>
						<option value="datetime">특정 날짜/시간</option>
					</select>
					{#if newAlertType === "datetime"}
						<input
							type="date"
							bind:value={newAlertDate}
							class="sketchy-input text-sm"
						/>
						<input
							type="time"
							bind:value={newAlertTime}
							class="sketchy-input text-sm"
						/>
					{:else}
						<div class="flex items-center gap-1.5">
							<input
								type="number"
								bind:value={newAlertMinutes}
								min="1"
								class="sketchy-input w-20 text-sm"
							/>
							<span class="text-sm text-muted-foreground whitespace-nowrap">
								분 전
							</span>
						</div>
					{/if}
				</div>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={addAlertEntry}
						class="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90"
					>
						추가
					</button>
					<button
						type="button"
						onclick={() => (showAddAlert = false)}
						class="px-3 py-1.5 text-sm border border-border rounded-md text-foreground hover:bg-muted"
					>
						취소
					</button>
				</div>
			</div>
		{:else}
			<button
				type="button"
				onclick={() => (showAddAlert = true)}
				class="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
			>
				<Plus class="w-3.5 h-3.5" />
				직접 알림 추가
			</button>
		{/if}
	</div>

	<div class="border-t border-border/50 pt-4 space-y-3">
		<label class="flex items-center gap-2 cursor-pointer">
			<input
				type="checkbox"
				checked={showOverdue}
				onchange={(e: Event) =>
					onUpdate({
						showOverdue: (e.target as HTMLInputElement).checked,
					})}
				class="rounded border-border text-primary focus:ring-primary"
			/>
			<span class="text-sm text-foreground">
				기한이 지나면 빨간색으로 강조 표시
			</span>
		</label>

		<div class="flex items-start gap-2">
			<input
				type="checkbox"
				id="autoPung"
				checked={autoPung}
				onchange={(e: Event) =>
					onUpdate({
						autoPung: (e.target as HTMLInputElement).checked,
					})}
				class="mt-0.5 rounded border-border text-destructive focus:ring-destructive"
			/>
			<div class="flex-1">
				<label
					for="autoPung"
					class="text-sm font-medium text-foreground cursor-pointer"
				>
					💥 기한 초과 시 자동 삭제 (펑)
				</label>
				<p class="text-xs text-muted-foreground mt-0.5">
					기한이 지나면 자동으로 할일이 삭제됩니다
				</p>
			</div>
		</div>

		{#if autoPung}
			<div class="ml-6 space-y-2">
				<label class="block text-xs font-medium text-foreground">
					삭제 시점
				</label>
				<select
					value={pungDelay}
					onchange={(e: Event) =>
						onUpdate({
							pungDelay: Number(
								(e.target as HTMLSelectElement).value,
							),
						})}
					class="sketchy-input w-full text-sm"
				>
					<option value={0}>즉시</option>
					<option value={60}>1시간 후</option>
					<option value={1440}>1일 후</option>
					<option value={4320}>3일 후</option>
				</select>
			</div>
		{/if}
	</div>
</div>
