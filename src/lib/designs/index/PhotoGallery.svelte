<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Play from '@lucide/svelte/icons/play';
	import Img from '#lib/components/Img.svelte';
	import Masonry from '#lib/components/Masonry.svelte';
	import type { Layout, PhotoItem } from '#lib/types.js';
	import { formatDuration, mediaUrl } from '#lib/utils.js';
	import { indexNumber } from './format.js';

	interface Props {
		photos: PhotoItem[];
		layout: Layout;
		href: (photo: PhotoItem) => string;
		onopen?: (index: number, event: MouseEvent) => void;
		selecting?: boolean;
		selected?: Set<number>;
		ontoggle?: (photo: PhotoItem, index: number, event: MouseEvent) => void;
		eagerCount?: number;
		/** Mono captions (number and file name) under each tile. */
		captions?: boolean;
	}

	let {
		photos,
		layout,
		href,
		onopen,
		selecting = false,
		selected,
		ontoggle,
		eagerCount = 4,
		captions = true
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
	>
		<span
			class="frame"
			style:aspect-ratio={layout === 'masonry' ? `${photo.w || 3} / ${photo.h || 2}` : undefined}
		>
			<Img
				src={mediaUrl(photo, 'thumb')}
				alt={photo.name}
				width={photo.w || undefined}
				height={photo.h || undefined}
				eager={index < eagerCount}
			/>
			{#if selecting}
				<span class="check" aria-hidden="true">
					{#if isSelected}<Check size={14} strokeWidth={2.5} />{/if}
				</span>
			{/if}
		</span>
		{#if captions}
			<span class="caption" aria-hidden="true">
				<span class="no">{indexNumber(index + 1, 3)}</span>
				<span class="name">{photo.name}</span>
				{#if photo.kind === 'video'}
					<span class="video"
						><Play size={9} strokeWidth={2} /> {formatDuration(photo.duration)}</span
					>
				{/if}
			</span>
		{:else if photo.kind === 'video'}
			<span class="video overlay" aria-hidden="true">
				<Play size={9} strokeWidth={2} />
				{formatDuration(photo.duration)}
			</span>
		{/if}
	</a>
{/snippet}

<div class="gallery">
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
</div>

<style>
	/* Columns follow the space the gallery is given, not the viewport, so it fits any grid cell. */
	.gallery {
		container-type: inline-size;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(0.75rem, 1.4vw, 1.25rem) clamp(0.35rem, 0.8vw, 0.6rem);
	}

	@container (min-width: 560px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@container (min-width: 860px) {
		.grid {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@container (min-width: 1280px) {
		.grid {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
	}

	.tile {
		position: relative;
		display: grid;
		gap: 0.35rem;
		text-decoration: none;
		cursor: zoom-in;
		outline-offset: 2px;
	}

	.frame {
		position: relative;
		display: block;
		overflow: hidden;
		background: var(--placeholder);
	}

	.grid .frame {
		aspect-ratio: 1;
	}

	.frame :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Hover: a hard frame drawn inside the photo, never a zoom. */
	.frame::after {
		content: '';
		position: absolute;
		inset: 0;
		border: 0 solid var(--ink);
		transition: border-width var(--fast) var(--ease);
		pointer-events: none;
	}

	.tile:hover .frame::after {
		border-width: 2px;
	}

	.tile.selecting {
		cursor: pointer;
	}

	.tile.selected .frame::after {
		border-width: 4px;
		border-color: var(--accent);
	}

	.caption {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		min-width: 0;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		line-height: 1.3;
		color: var(--text-subtle);
	}

	.no {
		flex: none;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		transition:
			background-color var(--fast) var(--ease),
			color var(--fast) var(--ease);
	}

	.tile:hover .no,
	.tile.selected .no {
		background: var(--ink);
		color: var(--bg);
	}

	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.video {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		flex: none;
		margin-left: auto;
		font-variant-numeric: tabular-nums;
		color: var(--text);
	}

	.video.overlay {
		position: absolute;
		left: 0;
		bottom: 0;
		padding: 0.2rem 0.45rem;
		background: var(--bg);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		pointer-events: none;
	}

	.check {
		position: absolute;
		top: 0;
		right: 0;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-left: 1px solid var(--text);
		border-bottom: 1px solid var(--text);
		background: var(--bg);
		color: var(--accent-text);
		transition: background-color var(--fast) var(--ease);
	}

	.selected .check {
		background: var(--accent);
		border-color: var(--accent);
	}

	@media (max-width: 480px) {
		.name {
			display: none;
		}
	}
</style>
