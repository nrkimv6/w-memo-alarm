<script lang="ts">
	import { cn } from '$lib/utils';

	type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'destructive';

	let {
		tone = 'neutral',
		children
	}: {
		tone?: Tone;
		children: import('svelte').Snippet;
	} = $props();

	const toneClass: Record<Tone, string> = {
		neutral: 'settings-pill-neutral',
		success: 'settings-pill-success',
		warning: 'settings-pill-warning',
		info: 'settings-pill-info',
		destructive: 'settings-pill-destructive'
	};
</script>

<span class={cn('settings-pill', toneClass[tone])}>
	{@render children()}
</span>
