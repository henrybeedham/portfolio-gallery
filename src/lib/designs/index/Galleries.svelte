<script lang="ts">
	import Images from '@lucide/svelte/icons/images';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import AlbumCard from './AlbumCard.svelte';
	import AlbumIndex from './AlbumIndex.svelte';
	import { plural } from '#lib/utils.js';
	import type { PageProps } from '../../../routes/galleries/$types';

	let { data }: PageProps = $props();
	const settings = $derived(data.settings);

	/** The span of years the listed galleries cover, e.g. “2024–2026”. */
	const years = $derived.by(() => {
		const all = data.albums.map((album) => album.date?.slice(0, 4)).filter(Boolean) as string[];
		if (!all.length) return '';
		const min = all.reduce((a, b) => (a < b ? a : b));
		const max = all.reduce((a, b) => (a > b ? a : b));
		return min === max ? min : `${min}–${max}`;
	});
</script>

<svelte:head>
	<title>Galleries — {settings.siteTitle}</title>
	<meta name="description" content={settings.galleriesIntro} />
</svelte:head>

<SiteHeader title={settings.siteTitle} />

<main class="container">
	<header class="intro grid-12">
		<p class="intro-meta">
			<span class="sec-no">Index</span>
			<span class="mono-label">{plural(data.albums.length, 'gallery', 'galleries')}</span>
			{#if years}<span class="mono-label">{years}</span>{/if}
		</p>
		<h1>Galleries</h1>
		{#if settings.galleriesIntro}
			<p class="lede fade-up" style:animation-delay="80ms">{settings.galleriesIntro}</p>
		{/if}
	</header>

	{#if data.albums.length}
		<section class="block" aria-labelledby="index-title">
			<header class="sec-head">
				<span class="sec-no">01 — List</span>
				<h2 id="index-title">By date</h2>
			</header>
			<AlbumIndex albums={data.albums} />
		</section>

		<section class="block" aria-labelledby="sheet-title">
			<header class="sec-head">
				<span class="sec-no">02 — Contact sheet</span>
				<h2 id="sheet-title">At a glance</h2>
			</header>
			<ol class="sheet">
				{#each data.albums as album, i (album.id)}
					<li><AlbumCard {album} shape="square" number={i + 1} /></li>
				{/each}
			</ol>
		</section>
	{:else}
		<div class="empty">
			<Images size={28} strokeWidth={1} />
			<h2>No galleries yet</h2>
			<p class="muted">New collections will be published here soon.</p>
			<a class="btn" href="/">Back to Home</a>
		</div>
	{/if}
</main>

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

<style>
	.intro {
		row-gap: 1.25rem;
		padding-block: clamp(1.25rem, 3vw, 2.5rem) clamp(3rem, 7vw, 6rem);
	}

	.intro-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 2.5rem;
		padding-top: 0.6rem;
		border-top: var(--rule);
	}

	h1 {
		font-size: clamp(3.25rem, 13vw, 13rem);
		font-weight: 650;
		line-height: 0.84;
		letter-spacing: -0.06em;
		margin-left: -0.05em;
		animation: index-wipe 0.45s var(--ease) both;
	}

	.lede {
		max-width: 36ch;
		font-size: clamp(1.1rem, 1.6vw, 1.4rem);
		font-weight: 450;
		line-height: 1.3;
		letter-spacing: -0.015em;
	}

	@media (min-width: 960px) {
		.lede {
			grid-column: 7 / -1;
		}
	}

	.block + .block {
		padding-top: clamp(3.5rem, 8vw, 7rem);
	}

	.sheet {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.75rem var(--col-gap);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	@media (min-width: 640px) {
		.sheet {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	@media (min-width: 1100px) {
		.sheet {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
	}

	.empty {
		display: grid;
		justify-items: start;
		gap: 1rem;
		padding: clamp(2rem, 6vw, 4rem) 0;
		border-top: var(--rule);
		color: var(--text-muted);
	}

	.empty h2 {
		font-size: clamp(1.8rem, 4vw, 3rem);
		letter-spacing: -0.04em;
		color: var(--text);
	}
</style>
