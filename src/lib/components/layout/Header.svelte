<script lang="ts">
	import { Sun, Moon, Settings } from 'lucide-svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import SettingsModal from './SettingsModal.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';

	let showSettings = $state(false);
</script>

<header
	class="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md"
>
	<div class="container flex h-14 items-center gap-4 px-4 mx-auto max-w-7xl">
		<div class="mr-4 flex items-center gap-2">
			<a href="/" class="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
				📒 Memo Alarm
			</a>
		</div>

		<div class="flex flex-1 items-center justify-end space-x-1">
			<Button variant="ghost" size="icon" class="rounded-full" onclick={() => themeStore.toggle()}>
				{#if themeStore.isDark}
					<Sun class="h-4 w-4" />
				{:else}
					<Moon class="h-4 w-4" />
				{/if}
				<span class="sr-only">Toggle theme</span>
			</Button>
			<Button variant="ghost" size="icon" class="rounded-full" onclick={() => showSettings = true}>
				<Settings class="h-4 w-4" />
				<span class="sr-only">Settings</span>
			</Button>
		</div>
	</div>
</header>

<SettingsModal bind:open={showSettings} onClose={() => showSettings = false} />
