<script lang="ts">
	import { cn } from '$utils';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	interface Props extends HTMLTextareaAttributes {
		label?: string;
		error?: string;
	}

	let { label, error, class: className, value = $bindable(''), ...rest }: Props = $props();
</script>

<div class="flex flex-col gap-1.5">
	{#if label}
		<label class="text-sm font-medium text-foreground">
			{label}
		</label>
	{/if}
	<textarea
		bind:value
		class={cn(
			'sketchy-input w-full min-h-[120px] resize-y',
			error && 'border-destructive focus:ring-destructive',
			className
		)}
		{...rest}
	></textarea>
	{#if error}
		<span class="text-xs text-destructive">{error}</span>
	{/if}
</div>
