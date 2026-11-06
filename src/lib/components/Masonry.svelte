<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface Props {
		items: T[];
		/** Height divided by width for each item. */
		ratio: (item: T) => number;
		key: (item: T) => string | number;
		/** [minimum container width, column count] pairs, ascending. */
		breakpoints?: [number, number][];
		/** Column count used before the container has been measured (server render). */
		initialColumns?: number;
		gap?: string;
		children: Snippet<[T, number]>;
	}

	let {
		items,
		ratio,
		key,
		breakpoints = [
			[0, 2],
			[720, 3],
			[1180, 4]
		],
		initialColumns = 3,
		gap = 'clamp(0.25rem, 0.5vw, 0.4rem)',
		children
	}: Props = $props();

	let width = $state(0);

	const count = $derived.by(() => {
		if (!width) return initialColumns;
		let columns = breakpoints[0]?.[1] ?? 1;
		for (const [min, value] of breakpoints) if (width >= min) columns = value;
		return columns;
	});

	/** Greedy shortest-column placement keeps reading order left-to-right and is stable when appending. */
	const columns = $derived.by(() => {
		const cols: { item: T; index: number }[][] = Array.from({ length: count }, () => []);
		const heights = new Array(count).fill(0);
		items.forEach((item, index) => {
			let target = 0;
			for (let c = 1; c < count; c++) if (heights[c] < heights[target] - 0.01) target = c;
			cols[target].push({ item, index });
			heights[target] += (ratio(item) || 1) + 0.04;
		});
		return cols;
	});
</script>

<div class="masonry" bind:clientWidth={width} style:--gap={gap} style:--count={count}>
	{#each columns as column, c (c)}
		<div class="column">
			{#each column as entry (key(entry.item))}
				{@render children(entry.item, entry.index)}
			{/each}
		</div>
	{/each}
</div>

<style>
	.masonry {
		display: grid;
		grid-template-columns: repeat(var(--count), minmax(0, 1fr));
		gap: var(--gap);
		align-items: start;
	}

	.column {
		display: grid;
		gap: var(--gap);
		min-width: 0;
	}
</style>
