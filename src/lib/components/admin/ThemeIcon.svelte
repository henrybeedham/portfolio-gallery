<script lang="ts">
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Leaf from '@lucide/svelte/icons/leaf';
	import Palette from '@lucide/svelte/icons/palette';
	import Flower from '@lucide/svelte/icons/flower';
	import Waves from '@lucide/svelte/icons/waves-horizontal';
	import Snowflake from '@lucide/svelte/icons/snowflake';
	import Flame from '@lucide/svelte/icons/flame';
	import Coffee from '@lucide/svelte/icons/coffee';
	import Mountain from '@lucide/svelte/icons/mountain';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Droplet from '@lucide/svelte/icons/droplet';
	import Cherry from '@lucide/svelte/icons/cherry';
	import Sunset from '@lucide/svelte/icons/sunset';

	/** Keep in sync with the "icon" enum in src/lib/themes/theme.schema.json. */
	const icons = {
		sun: Sun,
		moon: Moon,
		leaf: Leaf,
		palette: Palette,
		flower: Flower,
		waves: Waves,
		snowflake: Snowflake,
		flame: Flame,
		coffee: Coffee,
		mountain: Mountain,
		sparkles: Sparkles,
		droplet: Droplet,
		cherry: Cherry,
		sunset: Sunset
	};

	let { name, size = 14 }: { name: string; size?: number } = $props();
	const Icon = $derived(icons[name as keyof typeof icons] ?? Palette);
</script>

<Icon {size} strokeWidth={1.5} />
