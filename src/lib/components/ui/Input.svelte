<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className, value = $bindable(), ...rest } = $props();
</script>

<input class={cn('sketchy-input', className)} bind:value {...rest} />
