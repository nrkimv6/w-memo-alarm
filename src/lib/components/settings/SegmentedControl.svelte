<script lang="ts">
	import { cn } from '$lib/utils';

	type Option = { value: string; label: string };

	let {
		value,
		options,
		onchange
	}: {
		value: string;
		options: Option[];
		onchange: (v: string) => void;
	} = $props();
</script>

<div class="inline-flex w-full rounded-xl bg-muted p-1">
	{#each options as opt (opt.value)}
		{@const active = opt.value === value}
		<button
			onclick={() => onchange(opt.value)}
			class={cn(
				'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all',
				active
					? 'bg-card text-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'
			)}
		>
			{opt.label}
		</button>
	{/each}
</div>
