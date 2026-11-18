<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Img from '#lib/components/Img.svelte';
	import type { AlbumCardData } from '#lib/types.js';
	import { mediaUrl } from '#lib/utils.js';
	import { indexNumber } from './format.js';

	interface Props {
		album: AlbumCardData;
		/** `natural` keeps the cover's aspect ratio, `square` suits a contact sheet; otherwise 4:5. */
		shape?: 'natural' | 'portrait' | 'square';
		/** The item number shown in the caption. */
		number?: number;
		eager?: boolean;
	}

	let { album, shape = 'portrait', number, eager = false }: Props = $props();

	const ratio = $derived(
		shape === 'natural' && album.cover?.w && album.cover?.h
			? `${album.cover.w} / ${album.cover.h}`
			: shape === 'square'
				? '1'
				: '4 / 5'
	);
</script>

<a class="card" href="/{album.slug}">
	<div class="cover" style:aspect-ratio={ratio}>
		{#if album.cover}
			<Img
				src={mediaUrl(album.cover, 'medium')}
				alt=""
				width={album.cover.w || undefined}
				height={album.cover.h || undefined}
				{eager}
			/>
		{:else}
			<div class="placeholder" aria-hidden="true">
				<ImageIcon size={24} strokeWidth={1} />
			</div>
		{/if}
		{#if album.locked}
			<span class="lock" title="Password protected">
				<Lock size={13} strokeWidth={1.5} />
				<span class="visually-hidden">Password protected</span>
			</span>
		{/if}
	</div>
	<div class="info">
		{#if number !== undefined}<span class="no">{indexNumber(number)}</span>{/if}
		<h3>{album.title}</h3>
		<span class="meta">
			{album.count === null ? 'Private' : `${album.count} img`}
		</span>
	</div>
</a>

<style>
	.card {
		display: block;
		text-decoration: none;
	}

	.cover {
		position: relative;
		overflow: hidden;
		background: var(--placeholder);
	}

	.cover :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.placeholder {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--text-subtle);
	}

	.lock {
		position: absolute;
		top: 0;
		right: 0;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		background: var(--bg);
		color: var(--text);
	}

	.info {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: baseline;
		gap: 0.6rem;
		padding-top: 0.5rem;
		margin-top: 0.5rem;
		border-top: 1px solid var(--border);
		transition: border-color var(--fast) var(--ease);
	}

	.info:not(:has(.no)) {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	h3 {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.98rem;
		font-weight: 550;
		letter-spacing: -0.015em;
		line-height: 1.3;
		text-decoration: underline;
		text-decoration-color: transparent;
		text-decoration-thickness: 1px;
		text-underline-offset: 3px;
		transition: text-decoration-color var(--fast) var(--ease);
	}

	.card:hover h3 {
		text-decoration-color: currentColor;
	}

	.card:hover .info {
		border-top-color: var(--text);
	}

	.no,
	.meta {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
		color: var(--text-subtle);
	}

	.meta {
		text-transform: uppercase;
	}
</style>
