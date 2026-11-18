<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Img from '#lib/components/Img.svelte';
	import type { AlbumCardData } from '#lib/types.js';
	import { mediaUrl, plural } from '#lib/utils.js';

	interface Props {
		album: AlbumCardData;
		/** `natural` keeps the cover's aspect ratio (masonry), otherwise covers are cropped to 4:5. */
		shape?: 'natural' | 'portrait';
		eager?: boolean;
	}

	let { album, shape = 'portrait', eager = false }: Props = $props();

	const ratio = $derived(
		shape === 'natural' && album.cover?.w && album.cover?.h
			? `${album.cover.w} / ${album.cover.h}`
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
				<ImageIcon size={28} strokeWidth={1} />
			</div>
		{/if}
		{#if album.locked}
			<span class="lock" title="Password protected">
				<Lock size={13} strokeWidth={1.75} />
				<span class="visually-hidden">Password protected</span>
			</span>
		{/if}
	</div>
	<div class="info">
		<h3>{album.title}</h3>
		<p class="eyebrow">
			{album.count === null ? 'Password protected' : plural(album.count, 'image')}
		</p>
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

	.card:hover .cover :global(img.loaded) {
		transform: scale(1.04);
		filter: brightness(1.05);
	}

	.placeholder {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--text-subtle);
		background:
			linear-gradient(
				135deg,
				transparent 49.5%,
				var(--border) 49.5%,
				var(--border) 50.5%,
				transparent 50.5%
			),
			var(--placeholder);
	}

	.lock {
		position: absolute;
		top: 12px;
		right: 12px;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		background: var(--header-bg);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		color: var(--text);
	}

	.info {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 1rem;
	}

	h3 {
		font-size: clamp(1.15rem, 1.8vw, 1.4rem);
		transition: opacity 0.2s;
	}

	.card:hover h3 {
		opacity: 0.7;
	}

	.eyebrow {
		flex: none;
		font-size: 0.62rem;
	}
</style>
