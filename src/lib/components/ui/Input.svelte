<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className = '', value = $bindable(), ...rest }: {
		class?: string;
		value?: any;
		[key: string]: any;
	} = $props();
</script>

<input class={cn('sketchy-input', className)} bind:value {...rest} />
