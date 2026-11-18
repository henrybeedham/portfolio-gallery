<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Play from '@lucide/svelte/icons/play';
	import Img from '#lib/components/Img.svelte';
	import Masonry from '#lib/components/Masonry.svelte';
	import type { Layout, PhotoItem } from '#lib/types.js';
	import { formatDuration, mediaUrl } from '#lib/utils.js';
	import { photoTitle, roman } from './format.js';

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

	/** In the grid every print sits in the same square window, so portraits are narrower. */
	function printWidth(photo: PhotoItem) {
		if (layout === 'masonry' || !photo.w || !photo.h || photo.w >= photo.h) return '100%';
		return `${((photo.w / photo.h) * 100).toFixed(2)}%`;
	}
</script>

{#snippet plate(photo: PhotoItem, index: number)}
	{@const isSelected = selected?.has(photo.id) ?? false}
	<figure class="plate" class:selected={isSelected}>
		<a
			class="mat tile"
			class:selecting
			id="photo-{photo.id}"
			href={href(photo)}
			onclick={(event) => handleClick(event, photo, index)}
			aria-label={selecting
				? `${photo.name}${isSelected ? ' (selected)' : ''} — click to ${isSelected ? 'deselect' : 'select'}`
				: `${photo.name}${photo.kind === 'video' ? ' (video)' : ''}`}
			data-sveltekit-noscroll
			data-sveltekit-preload-data="off"
		>
			<span class="window">
				<span
					class="print"
					style:width={printWidth(photo)}
					style:aspect-ratio={`${photo.w || 3} / ${photo.h || 2}`}
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
							<Play size={10} strokeWidth={2} />
							{formatDuration(photo.duration)}
						</span>
					{/if}
				</span>
			</span>
			{#if selecting}
				<span class="check" aria-hidden="true">
					{#if isSelected}<Check size={13} strokeWidth={2.25} />{/if}
				</span>
			{/if}
		</a>
		<figcaption class="wall-label">
			<span class="plate-no">Plate {roman(index + 1)}</span>
			<span class="title">{photoTitle(photo.name)}</span>
		</figcaption>
	</figure>
{/snippet}

{#if layout === 'masonry'}
	<Masonry
		items={photos}
		ratio={(p) => (p.h && p.w ? p.h / p.w : 0.66) + 0.22}
		key={(p) => p.id}
		breakpoints={[
			[0, 2],
			[900, 3]
		]}
		gap="clamp(1rem, 3.2vw, 3rem)"
	>
		{#snippet children(photo, index)}
			{@render plate(photo, index)}
		{/snippet}
	</Masonry>
{:else}
	<div class="grid">
		{#each photos as photo, index (photo.id)}
			{@render plate(photo, index)}
		{/each}
	</div>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(1.5rem, 4vw, 3.75rem) clamp(0.75rem, 3vw, 3rem);
	}

	@media (min-width: 900px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.plate {
		margin: 0;
		min-width: 0;
	}

	.tile {
		position: relative;
		display: block;
		cursor: zoom-in;
		outline-offset: 4px;
		transition:
			border-color 0.6s var(--ease),
			background-color 0.6s var(--ease);
	}

	.tile:hover {
		border-color: var(--border-strong);
	}

	.tile.selecting {
		cursor: pointer;
	}

	.window {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.grid .window {
		aspect-ratio: 1;
	}

	.print {
		display: block;
		max-width: 100%;
		overflow: hidden;
	}

	.print :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.tile:hover .print :global(img.loaded) {
		filter: brightness(1.04);
	}

	.plate.selected .tile {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 10%, var(--bg-elevated));
	}

	.video {
		position: absolute;
		left: 8px;
		bottom: 8px;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.1rem 0.45rem 0.15rem;
		background: color-mix(in srgb, var(--bg-elevated) 82%, transparent);
		color: var(--text);
		font-family: var(--font-sans);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
		pointer-events: none;
	}

	.check {
		position: absolute;
		top: 6px;
		right: 6px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 1px solid var(--border-strong);
		background: var(--bg-elevated);
		color: var(--accent-text);
		transition:
			background-color 0.4s var(--ease),
			border-color 0.4s var(--ease);
	}

	.selected .check {
		background: var(--accent);
		border-color: var(--accent);
	}

	.wall-label {
		min-width: 0;
	}

	.plate-no {
		font-family: var(--font-sc);
		font-weight: 600;
		letter-spacing: 0.08em;
		font-size: 0.95rem;
		color: var(--highlight, var(--text-muted));
	}

	.wall-label .title {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.98rem;
		color: var(--text-muted);
		transition: color 0.6s var(--ease);
	}

	.plate:hover .title {
		color: var(--text);
	}

	@media (max-width: 560px) {
		.wall-label {
			padding-top: 0.55rem;
		}

		.plate-no {
			font-size: 0.85rem;
		}

		.wall-label .title {
			font-size: 0.88rem;
		}
	}
</style>
