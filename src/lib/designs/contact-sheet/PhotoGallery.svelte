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
	{@const frame = String(index + 1).padStart(2, '0')}
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
		<span class="holes sprockets" aria-hidden="true"></span>
		<span
			class="window"
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
					<Play size={10} strokeWidth={2} />
					{formatDuration(photo.duration)}
				</span>
			{/if}
			{#if isSelected}
				<span class="grease" aria-hidden="true"></span>
			{/if}
			{#if selecting}
				<span class="check" aria-hidden="true">
					{#if isSelected}<Check size={13} strokeWidth={2.5} />{/if}
				</span>
			{/if}
		</span>
		<span class="rebate" aria-hidden="true">
			<span class="edge no">{frame}</span>
			<span class="edge">▸ {frame}A</span>
		</span>
		<span class="holes sprockets" aria-hidden="true"></span>
	</a>
{/snippet}

{#if layout === 'masonry'}
	<div class="sheet strips">
		<Masonry
			items={photos}
			ratio={(p) => (p.h && p.w ? p.h / p.w : 0.66) + 0.08}
			key={(p) => p.id}
			gap="clamp(0.75rem, 1.5vw, 1.25rem)"
		>
			{#snippet children(photo, index)}
				{@render tile(photo, index)}
			{/snippet}
		</Masonry>
	</div>
{:else}
	<div class="sheet grid">
		{#each photos as photo, index (photo.id)}
			{@render tile(photo, index)}
		{/each}
	</div>
{/if}

<style>
	/*
	 * A contact sheet. In the grid, each row of frames reads as one strip of film: frames sit edge
	 * to edge on the film base with sprocket holes above and below. In masonry, each column is a
	 * vertical strip with its holes down the sides.
	 */
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(0.75rem, 2vw, 1.5rem) 0;
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
		display: flex;
		flex-direction: column;
		background: var(--film);
		text-decoration: none;
		cursor: zoom-in;
		outline-offset: -2px;
	}

	.tile.selecting {
		cursor: pointer;
	}

	.grid .tile {
		padding-inline: clamp(3px, 0.4vw, 6px);
	}

	.holes {
		flex: none;
		margin-inline: calc(-1 * clamp(3px, 0.4vw, 6px));
	}

	.window {
		position: relative;
		display: block;
		overflow: hidden;
		background: var(--placeholder);
	}

	.grid .window {
		aspect-ratio: 1;
	}

	.window :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.tile:hover .window :global(img.loaded) {
		filter: brightness(1.08) contrast(1.02);
	}

	.rebate {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		height: 18px;
		padding-inline: 2px;
		overflow: hidden;
	}

	.rebate .no {
		color: var(--text);
	}

	.tile:hover .rebate .no,
	.tile.selected .rebate .no {
		color: var(--text);
	}

	/* Masonry: vertical strips. */
	.strips :global(.column) {
		padding: 10px 18px;
		background:
			repeating-linear-gradient(
					to bottom,
					transparent 0 5px,
					var(--film-hole) 5px 12px,
					transparent 12px 18px
				)
				left 5px top 0 / 7px 100% no-repeat,
			repeating-linear-gradient(
					to bottom,
					transparent 0 5px,
					var(--film-hole) 5px 12px,
					transparent 12px 18px
				)
				right 5px top 0 / 7px 100% no-repeat,
			var(--film);
	}

	.strips .holes {
		display: none;
	}

	@media (max-width: 560px) {
		.strips :global(.column) {
			padding: 8px 12px;
			background-size:
				5px 100%,
				5px 100%,
				auto;
			background-position:
				left 3px top 0,
				right 3px top 0,
				0 0;
		}
	}

	/* Grease-pencil mark around a chosen frame. */
	.grease {
		position: absolute;
		inset: 7%;
		border: 3px solid var(--grease);
		border-radius: 46% 54% 44% 56% / 55% 45% 55% 45%;
		transform: rotate(-4deg);
		pointer-events: none;
		filter: drop-shadow(0 0 1px var(--film-hole));
	}

	.tile.selected .window {
		outline: 2px solid var(--grease);
		outline-offset: -2px;
	}

	.video {
		position: absolute;
		left: 6px;
		bottom: 6px;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.4rem;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.04em;
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
		border: 2px solid #fff;
		background: rgba(0, 0, 0, 0.25);
		color: var(--accent-text);
	}

	.selected .check {
		background: var(--grease);
		border-color: var(--grease);
		color: var(--bg);
	}
</style>
