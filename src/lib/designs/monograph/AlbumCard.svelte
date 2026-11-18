<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Img from '#lib/components/Img.svelte';
	import type { AlbumCardData } from '#lib/types.js';
	import { mediaUrl, plural } from '#lib/utils.js';
	import { roman } from './format.js';

	interface Props {
		album: AlbumCardData;
		/** `natural` keeps the cover's aspect ratio (masonry), otherwise covers are cropped to 4:5. */
		shape?: 'natural' | 'portrait';
		eager?: boolean;
		/** Catalogue number shown above the title, as a roman numeral. */
		number?: number;
	}

	let { album, shape = 'portrait', eager = false, number }: Props = $props();

	const ratio = $derived(
		shape === 'natural' && album.cover?.w && album.cover?.h
			? `${album.cover.w} / ${album.cover.h}`
			: '4 / 5'
	);

	const year = $derived(album.date?.slice(0, 4) ?? '');
</script>

<a class="card" href="/{album.slug}">
	<div class="mat">
		<div class="print" style:aspect-ratio={ratio}>
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
					<ImageIcon size={26} strokeWidth={1} />
				</div>
			{/if}
		</div>
		{#if album.locked}
			<span class="lock" title="Password protected">
				<Lock size={12} strokeWidth={1.75} />
				<span class="visually-hidden">Password protected</span>
			</span>
		{/if}
	</div>
	<div class="wall-label">
		{#if number}<span class="plate">No. {roman(number)}</span>{/if}
		<h3 class="title">{album.title}</h3>
		<p class="meta">
			{album.count === null ? 'Private' : plural(album.count, 'photograph')}{year
				? ` · ${year}`
				: ''}
		</p>
	</div>
</a>

<style>
	.card {
		display: block;
		text-decoration: none;
	}

	.mat {
		position: relative;
		transition: border-color 0.6s var(--ease);
	}

	.card:hover .mat {
		border-color: var(--border-strong);
	}

	.print {
		overflow: hidden;
	}

	.print :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card:hover .print :global(img.loaded) {
		filter: brightness(1.04);
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
		width: calc(var(--mat-pad) + 2px);
		min-width: 22px;
		height: calc(var(--mat-pad) + 2px);
		min-height: 22px;
		color: var(--text-muted);
	}

	h3.title {
		font-family: var(--font-serif);
		font-size: clamp(1.15rem, 1.7vw, 1.35rem);
		font-weight: 400;
		line-height: 1.25;
		transition: color 0.6s var(--ease);
	}

	.card:hover h3 {
		color: var(--text-muted);
	}

	.meta {
		margin-top: 0.15rem;
	}
</style>
