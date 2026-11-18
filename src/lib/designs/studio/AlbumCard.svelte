<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Img from '#lib/components/Img.svelte';
	import type { AlbumCardData } from '#lib/types.js';
	import { formatDay, mediaUrl, plural } from '#lib/utils.js';

	interface Props {
		album: AlbumCardData;
		/** `natural` keeps the cover's aspect ratio (masonry); `portrait` crops to 4:5; `wide` to 4:3. */
		shape?: 'natural' | 'portrait' | 'wide';
		eager?: boolean;
	}

	let { album, shape = 'portrait', eager = false }: Props = $props();

	const ratio = $derived(
		shape === 'natural' && album.cover?.w && album.cover?.h
			? `${album.cover.w} / ${album.cover.h}`
			: shape === 'wide'
				? '4 / 3'
				: '4 / 5'
	);
</script>

<a class="album-card" href="/{album.slug}">
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
				<ImageIcon size={28} strokeWidth={1.5} />
			</div>
		{/if}
		<span class="count">
			{#if album.locked}
				<Lock size={12} strokeWidth={2} />
				Private
			{:else if album.count !== null}
				{plural(album.count, 'photo')}
			{/if}
		</span>
	</div>
	<div class="info">
		<div class="text">
			<h3>{album.title}</h3>
			{#if album.date}
				<p>{formatDay(album.date)}</p>
			{:else if album.locked}
				<p>Password protected</p>
			{/if}
		</div>
		<span class="go" aria-hidden="true"><ArrowUpRight size={16} strokeWidth={2} /></span>
	</div>
</a>

<style>
	.album-card {
		display: grid;
		gap: 0.25rem;
		padding: 8px;
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-sm);
		text-decoration: none;
		transition:
			transform var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}

	.album-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow);
	}

	.cover {
		position: relative;
		overflow: hidden;
		border-radius: calc(var(--radius-lg) - 8px);
		background: var(--placeholder);
	}

	.cover :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.album-card:hover .cover :global(img.loaded) {
		transform: scale(1.04);
	}

	.placeholder {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--text-subtle);
		background: radial-gradient(circle at 30% 20%, var(--surface) 0%, var(--placeholder) 70%);
	}

	.count {
		position: absolute;
		left: 10px;
		bottom: 10px;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.65rem;
		border-radius: var(--radius-pill);
		background: var(--header-bg);
		backdrop-filter: blur(10px) saturate(1.3);
		-webkit-backdrop-filter: blur(10px) saturate(1.3);
		color: var(--text);
		font-size: 0.74rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.count:empty {
		display: none;
	}

	.info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.5rem 0.4rem 0.6rem;
	}

	.text {
		min-width: 0;
	}

	h3 {
		font-size: 1.02rem;
		font-weight: 650;
		letter-spacing: -0.015em;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.text p {
		font-size: 0.8rem;
		color: var(--text-subtle);
	}

	.go {
		flex: none;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--surface);
		color: var(--text-muted);
		transition:
			background-color var(--dur) var(--ease),
			color var(--dur) var(--ease),
			transform var(--dur) var(--ease);
	}

	.album-card:hover .go {
		background: var(--ink);
		color: var(--bg);
		transform: rotate(45deg);
	}
</style>
