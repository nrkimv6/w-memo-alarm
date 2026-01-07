<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className, variant = 'default', children, ...rest } = $props();

	const variants: Record<string, string> = {
		default: 'memo-tag',
		sketchy: 'memo-tag sketchy-tag'
	};
</script>

<span class={cn(variants[variant], className)} {...rest}>
	{@render children?.()}
</span>
