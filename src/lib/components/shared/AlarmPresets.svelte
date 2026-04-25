<script lang="ts">
	type AlarmPreset = {
		label: string;
		minutes?: number;
		time?: string;
		date?: string;
		mode?: "repeat" | "once";
		days?: number[];
	};

	interface Props {
		presets: AlarmPreset[];
		variant?: "primary" | "warning";
		onSelect: (preset: AlarmPreset) => void;
	}

	let { presets, variant = "primary", onSelect }: Props = $props();

	function getVariantClasses(currentVariant: "primary" | "warning") {
		return currentVariant === "warning"
			? "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50"
			: "bg-primary/10 text-primary hover:bg-primary/20";
	}
</script>

<div class="flex flex-wrap gap-1.5">
	{#each presets as preset (preset.label)}
		<button
			type="button"
			onclick={() => onSelect(preset)}
			class={`px-2.5 py-1 text-xs rounded-full transition-colors ${getVariantClasses(
				variant,
			)}`}
		>
			{preset.label}
		</button>
	{/each}
</div>
