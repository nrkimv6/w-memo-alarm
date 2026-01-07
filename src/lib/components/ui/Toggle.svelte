<script lang="ts">
	import { cn } from '$lib/utils';

	let { checked = $bindable(false), disabled = false, class: className, ...rest } = $props();
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	{disabled}
	onclick={() => !disabled && (checked = !checked)}
	class={cn('toggle-switch', checked && 'active', className)}
	{...rest}
>
	<span class="toggle-switch-thumb"></span>
</button>
