<script lang="ts">
	import { Plus, Bell, BellOff } from 'lucide-svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { cn } from '$lib/utils';

	let inputValue = $state('');
	let inputRef = $state<HTMLInputElement | null>(null);
	let useAutoReminder = $state(settingsStore.settings.autoReminderOnCreate);

	function handleSubmit() {
		const title = inputValue.trim();
		if (!title) return;

		const data: Parameters<typeof memosStore.add>[0] = {
			title,
			content: '',
			tags: []
		};

		// Apply auto reminder if enabled
		if (useAutoReminder) {
			const defaultReminder = settingsStore.getDefaultReminder();
			data.reminder = { ...defaultReminder };
		}

		memosStore.add(data);
		toastStore.success(useAutoReminder ? '메모 저장됨 (알림 설정됨)' : '메모 저장됨');
		inputValue = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
		}
	}

	function toggleAutoReminder() {
		useAutoReminder = !useAutoReminder;
	}
</script>

<div class="flex items-center gap-2 w-full">
	<div class="relative flex-1">
		<input
			bind:this={inputRef}
			type="text"
			placeholder="빠른 메모 추가... (Enter로 저장)"
			bind:value={inputValue}
			onkeydown={handleKeydown}
			data-quick-memo-input
			class="w-full pl-4 pr-10 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sketchy-input"
		/>
		<button
			type="button"
			onclick={toggleAutoReminder}
			class={cn(
				'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors',
				useAutoReminder
					? 'text-primary bg-primary/10'
					: 'text-muted-foreground hover:text-foreground hover:bg-muted'
			)}
			title={useAutoReminder ? '자동 알림 켜짐' : '자동 알림 꺼짐'}
		>
			{#if useAutoReminder}
				<Bell class="w-4 h-4" />
			{:else}
				<BellOff class="w-4 h-4" />
			{/if}
		</button>
	</div>
	<button
		type="button"
		onclick={handleSubmit}
		disabled={!inputValue.trim()}
		class={cn(
			'p-2.5 rounded-lg transition-colors',
			inputValue.trim()
				? 'bg-primary text-primary-foreground hover:bg-primary/90'
				: 'bg-muted text-muted-foreground cursor-not-allowed'
		)}
		title="추가"
	>
		<Plus class="w-5 h-5" />
	</button>
</div>
