<script lang="ts">
	import { Bell, BellOff } from 'lucide-svelte';
	import { memosStore } from '$lib/stores/memos.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import { cn } from '$lib/utils';

	let inputValue = $state('');
	let inputRef = $state<HTMLInputElement | null>(null);
	let useAutoReminder = $state(settingsStore.settings.autoReminderOnCreate);

	// URL 패턴 감지
	const urlPattern = /^(https?:\/\/[^\s]+)$/i;

	function getDomain(url: string): string {
		try {
			return new URL(url).hostname.replace('www.', '');
		} catch {
			return url;
		}
	}

	function handleSubmit() {
		const value = inputValue.trim();
		if (!value) return;

		const isUrl = urlPattern.test(value);

		const data: Parameters<typeof memosStore.add>[0] = {
			title: isUrl ? getDomain(value) : value,
			content: '',
			tags: [],
			// URL인 경우 자동으로 북마크로 추가
			url: isUrl ? value : undefined,
			emoji: isUrl ? '🔗' : undefined
		};

		// Apply auto reminder if enabled
		if (useAutoReminder) {
			const defaultReminder = settingsStore.getDefaultReminder();
			data.reminder = { ...defaultReminder };
		}

		memosStore.add(data);
		const message = isUrl
			? '북마크 저장됨'
			: (useAutoReminder ? '메모 저장됨 (알림 설정됨)' : '메모 저장됨');
		toastStore.success(message);
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

<div class="relative w-full">
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
