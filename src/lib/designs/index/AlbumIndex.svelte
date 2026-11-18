<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Img from '#lib/components/Img.svelte';
	import type { AlbumCardData } from '#lib/types.js';
	import { mediaUrl } from '#lib/utils.js';
	import { formatNumericDay, indexNumber } from './format.js';

	interface Props {
		albums: AlbumCardData[];
		/** The number given to the first row. */
		start?: number;
	}

	let { albums, start = 1 }: Props = $props();

	/** The row whose cover the preview shows: the last one hovered or focused. */
	let hovered = $state<number | null>(null);
	const active = $derived(
		hovered ??
			Math.max(
				0,
				albums.findIndex((album) => album.cover)
			)
	);
	const current = $derived(albums[active] ?? albums[0]);
</script>

<div class="index">
	<div class="list">
		<div class="row head" aria-hidden="true">
			<span class="no">No.</span>
			<span class="title">Title</span>
			<span class="date">Date</span>
			<span class="count">Count</span>
			<span class="go"></span>
		</div>
		<ol>
			{#each albums as album, i (album.id)}
				<li>
					<a
						class="row"
						class:active={i === active}
						href="/{album.slug}"
						onpointerenter={() => (hovered = i)}
						onfocus={() => (hovered = i)}
					>
						<span class="no">{indexNumber(start + i)}</span>
						<span class="thumb" aria-hidden="true">
							{#if album.cover}
								<Img src={mediaUrl(album.cover, 'thumb')} alt="" />
							{/if}
						</span>
						<span class="title">
							<span class="title-text">{album.title}</span>
							{#if album.locked}
								<span class="lock" title="Password protected">
									<Lock size={13} strokeWidth={1.5} />
									<span class="visually-hidden">Password protected</span>
								</span>
							{/if}
						</span>
						<span class="date">{formatNumericDay(album.date) || '—'}</span>
						<span class="count">
							{#if album.count === null}
								Private
							{:else}
								{indexNumber(album.count, 3)}<span class="unit">img</span>
							{/if}
						</span>
						<span class="go" aria-hidden="true"><ArrowUpRight size={16} strokeWidth={1.5} /></span>
					</a>
				</li>
			{/each}
		</ol>
	</div>

	{#if current}
		<figure class="preview" aria-hidden="true">
			<div class="frame">
				{#if current.cover}
					{#key current.id}
						<Img src={mediaUrl(current.cover, 'medium')} alt="" eager />
					{/key}
				{:else}
					<span class="empty"><ImageIcon size={28} strokeWidth={1} /></span>
				{/if}
			</div>
			<figcaption>
				<span>Fig. {indexNumber(start + active)}</span>
				<span class="cap-title">{current.title}</span>
			</figcaption>
		</figure>
	{/if}
</div>

<style>
	.index {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		column-gap: var(--col-gap);
		align-items: start;
	}

	.list {
		grid-column: 1 / -1;
		min-width: 0;
	}

	@media (min-width: 960px) {
		.list {
			grid-column: 1 / span 8;
		}
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.row {
		display: grid;
		grid-template-columns: 3.5rem minmax(0, 1fr) 7rem 5.5rem 1.5rem;
		align-items: center;
		column-gap: 1rem;
		padding: 0.85rem 0.5rem;
		border-bottom: 1px solid var(--border);
		text-decoration: none;
		transition:
			background-color var(--fast) var(--ease),
			color var(--fast) var(--ease);
	}

	.head {
		padding-block: 0.5rem;
		border-bottom-color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.no,
	.date,
	.count {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
	}

	.no,
	.date {
		color: var(--text-muted);
	}

	.count,
	.head .count {
		text-align: right;
	}

	.unit {
		margin-left: 0.35em;
		color: var(--text-subtle);
	}

	.title {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}

	.row:not(.head) .title {
		font-size: clamp(1.15rem, 2.2vw, 1.75rem);
		font-weight: 550;
		letter-spacing: -0.03em;
		line-height: 1.1;
	}

	.title-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lock {
		display: inline-grid;
		flex: none;
		color: var(--text-muted);
	}

	.go {
		display: grid;
		justify-items: end;
		color: var(--text-subtle);
	}

	.thumb {
		display: none;
	}

	/* Invert the row under the pointer, the Swiss way: no zoom, no lift. */
	a.row:hover,
	a.row:focus-visible {
		background: var(--ink);
		color: var(--bg);
		outline: none;
	}

	a.row:hover :is(.no, .date, .unit, .go, .lock),
	a.row:focus-visible :is(.no, .date, .unit, .go, .lock) {
		color: inherit;
	}

	/* The preview cell */

	.preview {
		display: none;
		margin: 0;
	}

	@media (min-width: 960px) {
		.preview {
			display: grid;
			gap: 0.6rem;
			grid-column: 9 / -1;
			position: sticky;
			top: calc(var(--header-height) + 1.5rem);
		}
	}

	.frame {
		position: relative;
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--placeholder);
	}

	.frame :global(img) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.frame :global(img.loaded) {
		animation: index-wipe var(--slow) var(--ease) both;
	}

	.empty {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--text-subtle);
	}

	figcaption {
		display: flex;
		gap: 1rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.cap-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text);
	}

	/* Phones and tablets: no hover, so each row carries its own thumbnail. */
	@media (max-width: 959px) {
		.row {
			grid-template-columns: 2.25rem 3.25rem minmax(0, 1fr) auto;
			grid-template-areas:
				'no thumb title title'
				'no thumb date count';
			row-gap: 0.25rem;
			padding-inline: 0;
		}

		.head {
			display: none;
		}

		.no {
			grid-area: no;
			align-self: start;
		}

		.thumb {
			grid-area: thumb;
			display: block;
			width: 3.25rem;
			aspect-ratio: 1;
			overflow: hidden;
			background: var(--placeholder);
		}

		.thumb :global(img) {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		.title {
			grid-area: title;
		}

		.date {
			grid-area: date;
		}

		.count {
			grid-area: count;
		}

		.go {
			display: none;
		}
	}
</style>
