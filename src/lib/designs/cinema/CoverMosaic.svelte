<script lang="ts">
	import AlbumCard from '#lib/components/AlbumCard.svelte';
	import type { AlbumCardData } from '#lib/types.js';

	interface Props {
		albums: AlbumCardData[];
		/** How many covers to load eagerly. */
		eagerCount?: number;
	}

	let { albums, eagerCount = 2 }: Props = $props();

	/** Column and row spans on a 12-column grid. */
	type Span = { c: number; r: number };

	/*
	 * A repeating sequence of blocks, each of which fills whole rows, so the mosaic varies (a wide
	 * feature, a tall one, a row of three, a pair) without leaving holes.
	 */
	const BLOCKS: Span[][] = [
		[
			{ c: 8, r: 2 },
			{ c: 4, r: 2 }
		],
		[
			{ c: 4, r: 1 },
			{ c: 4, r: 1 },
			{ c: 4, r: 1 }
		],
		[
			{ c: 4, r: 2 },
			{ c: 8, r: 1 },
			{ c: 8, r: 1 }
		],
		[
			{ c: 6, r: 1 },
			{ c: 6, r: 1 }
		]
	];

	const spans = $derived.by(() => {
		const result: Span[] = [];
		let block = 0;
		while (result.length < albums.length) {
			const pattern = BLOCKS[block % BLOCKS.length];
			const left = albums.length - result.length;
			if (left >= pattern.length) {
				result.push(...pattern);
			} else {
				// Not enough covers to finish the block: share the row out evenly instead.
				const r = block === 0 ? 2 : 1;
				for (let i = 0; i < left; i++) result.push({ c: 12 / left, r });
			}
			block++;
		}
		return result;
	});

	/** Shape on phones, where the mosaic is one column. */
	function ratio({ c, r }: Span) {
		if (r === 2 && c <= 4) return '4 / 5';
		if (c === 12) return '16 / 10';
		return '5 / 4';
	}
</script>

<ul class="mosaic">
	{#each albums as album, index (album.id)}
		{@const span = spans[index]}
		<li
			class="tile"
			style:--c={span.c}
			style:--c2={span.c >= 6 ? 2 : 1}
			style:--r={span.r}
			style:--ar={ratio(span)}
		>
			<AlbumCard {album} eager={index < eagerCount} />
		</li>
	{/each}
</ul>

<style>
	.mosaic {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--tile-gap);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tile {
		aspect-ratio: var(--ar);
		min-width: 0;
		animation: cinema-fade-in 1.2s var(--ease) both;
	}

	@media (min-width: 641px) {
		.mosaic {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-auto-rows: clamp(220px, 36vw, 380px);
			grid-auto-flow: row dense;
		}

		.tile {
			aspect-ratio: auto;
			grid-column: span var(--c2);
			grid-row: span var(--r);
		}
	}

	@media (min-width: 1024px) {
		.mosaic {
			grid-template-columns: repeat(12, minmax(0, 1fr));
			grid-auto-rows: clamp(220px, 21vw, 420px);
		}

		.tile {
			grid-column: span var(--c);
		}
	}
</style>
