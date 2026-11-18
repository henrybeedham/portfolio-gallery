<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Img from '#lib/components/Img.svelte';
	import type { AlbumCardData } from '#lib/types.js';
	import { mediaUrl, plural } from '#lib/utils.js';

	interface Props {
		album: AlbumCardData;
		/** Accepted for compatibility with the Editorial card; Cinema tiles are sized by their box. */
		shape?: 'natural' | 'portrait';
		eager?: boolean;
	}

	let { album, eager = false }: Props = $props();

	const year = $derived(album.date?.slice(0, 4) ?? null);
</script>

<!-- A cover tile: the photo fills its box and the title sits over it. Size it from outside. -->
<a class="card" href="/{album.slug}">
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
	<span class="scrim" aria-hidden="true"></span>
	{#if album.locked}
		<span class="lock" title="Password protected">
			<Lock size={13} strokeWidth={1.75} />
			<span class="visually-hidden">Password protected</span>
		</span>
	{/if}
	<span class="info">
		<span class="meta eyebrow">
			{album.count === null ? 'Private' : plural(album.count, 'image')}{#if year}<span
					class="dot"
					aria-hidden="true"
				></span>{year}{/if}
		</span>
		<h3>{album.title}</h3>
	</span>
</a>

<style>
	.card {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--placeholder);
		text-decoration: none;
		container-type: inline-size;
		isolation: isolate;
	}

	.card :global(img) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition:
			opacity 1s var(--ease),
			transform 1.8s var(--ease-slow),
			filter 1s var(--ease);
	}

	.card:hover :global(img.loaded),
	.card:focus-visible :global(img.loaded) {
		transform: scale(1.05);
	}

	.placeholder {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--text-subtle);
	}

	.scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			var(--scrim-strong) 0%,
			color-mix(in srgb, var(--bg) 45%, transparent) 30%,
			transparent 62%
		);
		opacity: 0.92;
		transition: opacity 0.8s var(--ease);
	}

	.card:hover .scrim,
	.card:focus-visible .scrim {
		opacity: 1;
	}

	.lock {
		position: absolute;
		top: 12px;
		right: 12px;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--glass);
		border: 1px solid var(--glass-border);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		color: var(--text);
	}

	.info {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: grid;
		gap: 0.4rem;
		padding: clamp(0.9rem, 5cqi, 2rem);
		transition: transform 0.9s var(--ease-slow);
	}

	.card:hover .info,
	.card:focus-visible .info {
		transform: translateY(-4px);
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.78rem;
	}

	.dot {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: currentColor;
	}

	h3 {
		font-size: clamp(1.5rem, 8.5cqi, 4.6rem);
		font-weight: 500;
		line-height: 0.95;
		overflow-wrap: anywhere;
	}
</style>
