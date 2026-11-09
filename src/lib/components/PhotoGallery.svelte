<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Play from '@lucide/svelte/icons/play';
	import Img from './Img.svelte';
	import Masonry from './Masonry.svelte';
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
		data-sveltekit-noscroll
		data-sveltekit-preload-data="off"
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
	<Masonry items={photos} ratio={(p) => (p.h && p.w ? p.h / p.w : 0.66)} key={(p) => p.id}>
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
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(0.25rem, 0.5vw, 0.4rem);
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

	.tile {
		position: relative;
		display: block;
		overflow: hidden;
		background: var(--placeholder);
		cursor: zoom-in;
		outline-offset: 2px;
	}

	.grid .tile {
		aspect-ratio: 1;
	}

	.tile :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.tile:hover :global(img.loaded) {
		transform: scale(1.035);
		filter: brightness(1.04);
	}

	.tile.selecting {
		cursor: pointer;
	}

	.tile::after {
		content: '';
		position: absolute;
		inset: 0;
		border: 3px solid transparent;
		transition: border-color 0.2s var(--ease);
		pointer-events: none;
	}

	.tile.selected::after {
		border-color: var(--accent);
	}

	.tile.selected :global(img) {
		transform: scale(0.97);
	}

	.video {
		position: absolute;
		left: 10px;
		bottom: 10px;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.45rem;
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		pointer-events: none;
	}

	.check {
		position: absolute;
		top: 10px;
		right: 10px;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 1.5px solid #fff;
		background: rgba(0, 0, 0, 0.18);
		color: var(--accent-text);
		box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
		transition: background-color 0.2s var(--ease);
	}

	.selected .check {
		background: var(--accent);
		border-color: var(--accent);
	}
</style>
