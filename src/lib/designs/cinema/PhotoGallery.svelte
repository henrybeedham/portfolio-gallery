<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Play from '@lucide/svelte/icons/play';
	import Img from '#lib/components/Img.svelte';
	import Masonry from '#lib/components/Masonry.svelte';
	import type { Layout, PhotoItem } from '#lib/types.js';
	import { formatDuration, mediaUrl } from '#lib/utils.js';

	interface Props {
		photos: PhotoItem[];
		layout: Layout;
		href: (photo: PhotoItem) => string;
		onopen?: (index: number, event: MouseEvent) => void;
		selecting?: boolean;
		selected?: Set<number>;
		ontoggle?: (photo: PhotoItem, index: number, event: MouseEvent) => void;
		eagerCount?: number;
	}

	let {
		photos,
		layout,
		href,
		onopen,
		selecting = false,
		selected,
		ontoggle,
		eagerCount = 4
	}: Props = $props();

	function handleClick(event: MouseEvent, photo: PhotoItem, index: number) {
		// Let the browser handle new-tab / new-window clicks.
		if (event.metaKey || event.ctrlKey || event.button !== 0) return;
		if (selecting) {
			event.preventDefault();
			ontoggle?.(photo, index, event);
			return;
		}
		if (onopen) {
			event.preventDefault();
			onopen(index, event);
		}
	}
</script>

{#snippet tile(photo: PhotoItem, index: number)}
	{@const isSelected = selected?.has(photo.id) ?? false}
	<a
		class="tile"
		class:selecting
		class:selected={isSelected}
		id="photo-{photo.id}"
		href={href(photo)}
		onclick={(event) => handleClick(event, photo, index)}
		aria-label={selecting
			? `${photo.name}${isSelected ? ' (selected)' : ''} — click to ${isSelected ? 'deselect' : 'select'}`
			: `${photo.name}${photo.kind === 'video' ? ' (video)' : ''}`}
		data-sveltekit-reset="false"
		data-sveltekit-preload-data="false"
		style:aspect-ratio={layout === 'masonry' ? `${photo.w || 3} / ${photo.h || 2}` : undefined}
	>
		<Img
			src={mediaUrl(photo, 'thumb')}
			alt={photo.name}
			width={photo.w || undefined}
			height={photo.h || undefined}
			eager={index < eagerCount}
		/>
		{#if photo.kind === 'video'}
			<span class="video" aria-hidden="true">
				<Play size={11} strokeWidth={2} />
				{formatDuration(photo.duration)}
			</span>
		{/if}
		{#if selecting}
			<span class="check" aria-hidden="true">
				{#if isSelected}<Check size={14} strokeWidth={2.5} />{/if}
			</span>
		{/if}
	</a>
{/snippet}

{#if layout === 'masonry'}
	<Masonry
		items={photos}
		ratio={(p) => (p.h && p.w ? p.h / p.w : 0.66)}
		key={(p) => p.id}
		breakpoints={[
			[0, 2],
			[720, 3],
			[1180, 4],
			[1800, 5]
		]}
		gap="var(--tile-gap)"
	>
		{#snippet children(photo, index)}
			{@render tile(photo, index)}
		{/snippet}
	</Masonry>
{:else}
	<div class="grid">
		{#each photos as photo, index (photo.id)}
			{@render tile(photo, index)}
		{/each}
	</div>
{/if}

<style>
	/* Edge to edge, with hairline gaps: the photos are the page. */
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--tile-gap);
	}

	@media (min-width: 720px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (min-width: 1100px) {
		.grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (min-width: 1700px) {
		.grid {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
	}

	.tile {
		position: relative;
		display: block;
		overflow: hidden;
		background: var(--placeholder);
		cursor: zoom-in;
		outline-offset: -3px;
	}

	.grid .tile {
		aspect-ratio: 1;
	}

	.tile :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition:
			opacity 1s var(--ease),
			transform 1.6s var(--ease-slow),
			filter 0.8s var(--ease);
	}

	.tile:hover :global(img.loaded) {
		transform: scale(1.04);
	}

	/* Neighbours dim slightly while one is hovered, like house lights going down. */
	@media (hover: hover) {
		.grid:hover .tile:not(:hover) :global(img.loaded) {
			filter: brightness(0.88) saturate(0.9);
		}
	}

	.tile.selecting {
		cursor: pointer;
	}

	.tile::after {
		content: '';
		position: absolute;
		inset: 0;
		box-shadow: inset 0 0 0 0 var(--accent);
		transition: box-shadow 0.3s var(--ease);
		pointer-events: none;
	}

	.tile.selected::after {
		box-shadow: inset 0 0 0 4px var(--accent);
	}

	.tile.selected :global(img) {
		transform: scale(0.94);
	}

	.video {
		position: absolute;
		left: 10px;
		bottom: 10px;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.55rem;
		border-radius: var(--pill);
		background: var(--glass);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		color: var(--text);
		font-size: 0.72rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}

	.check {
		position: absolute;
		top: 10px;
		right: 10px;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border: 1.5px solid color-mix(in srgb, var(--bg) 90%, transparent);
		border-radius: 50%;
		background: color-mix(in srgb, var(--lightbox-bg) 30%, transparent);
		color: var(--accent-text);
		transition:
			background-color 0.25s var(--ease),
			border-color 0.25s var(--ease);
	}

	.selected .check {
		background: var(--accent);
		border-color: var(--accent);
	}
</style>
