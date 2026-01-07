<script lang="ts">
	import { cn } from '$lib/utils';

	let { class: className, children, ...rest } = $props();
</script>

<div class={cn('memo-card', className)} {...rest}>
	{@render children?.()}
</div>
