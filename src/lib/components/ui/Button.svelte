<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		class: className = '',
		variant = 'primary',
		size = 'md',
		children,
		...rest
	}: {
		class?: string;
		variant?: string;
		size?: string;
		children: any;
		[key: string]: any;
	} = $props();

	const variants: Record<string, string> = {
		primary: 'btn-primary',
		secondary: 'btn-secondary',
		ghost: 'btn-ghost',
		destructive: 'btn-destructive'
	};

	const sizes: Record<string, string> = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm',
		lg: 'px-6 py-3 text-base',
		icon: 'p-2'
	};
</script>

<button class={cn('btn', variants[variant], sizes[size], className)} {...rest}>
	{@render children?.()}
</button>
