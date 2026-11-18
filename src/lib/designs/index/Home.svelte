<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import PhotoGallery from '#lib/components/PhotoGallery.svelte';
	import AlbumIndex from './AlbumIndex.svelte';
	import Img from '#lib/components/Img.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import { mediaUrl, paragraphs, plural, viewQuery } from '#lib/utils.js';
	import { indexNumber } from './format.js';
	import type { PhotoItem } from '#lib/types.js';
	import type { PageProps } from '../../../routes/$types';

	let { data }: PageProps = $props();

	const settings = $derived(data.settings);
	const heroLines = $derived(settings.heroTitle.split('\n').filter((line) => line.trim()));
	const featured = $derived(data.featured);
	const featuredPhotos = $derived(featured?.photos ?? []);
	const galleryCount = $derived(data.albums.length + (featured ? 1 : 0));
	const hasContact = $derived(
		settings.showContactOnHome && !!(settings.contactEmail || settings.contactPhone)
	);

	const SCROLL_KEY = 'gallery:home-scroll';

	function photoHref(photo: PhotoItem) {
		if (!featured) return '#';
		return `/${featured.slug}/photo/${photo.id}${viewQuery(featured.view, { sort: featured.sortOrder }, { from: 'home' })}`;
	}

	function rememberScroll() {
		try {
			sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
		} catch {
			// storage unavailable
		}
	}

	const lightboxIndex = $derived(
		page.state.lightbox != null
			? featuredPhotos.findIndex((photo) => photo.id === page.state.lightbox)
			: -1
	);

	function openLightbox(index: number) {
		rememberScroll();
		const photo = featuredPhotos[index];
		goto(photoHref(photo), { shallow: true, state: { lightbox: photo.id } });
	}

	function navigateLightbox(index: number) {
		const photo = featuredPhotos[index];
		goto(photoHref(photo), { shallow: true, replace: true, state: { lightbox: photo.id } });
	}

	onMount(() => {
		// Returning from a featured photo without browser history (e.g. a reload): restore the position.
		if (location.hash !== '#work') return;
		try {
			const y = Number(sessionStorage.getItem(SCROLL_KEY));
			sessionStorage.removeItem(SCROLL_KEY);
			if (y) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
		} catch {
			// storage unavailable
		}
	});
</script>

<svelte:head>
	<title>{settings.siteTitle}</title>
	<meta name="description" content={settings.heroDescription} />
	<meta property="og:title" content={settings.siteTitle} />
	<meta property="og:description" content={settings.heroDescription} />
	{#if settings.heroImage}
		<meta property="og:image" content="/site/hero/large?v={settings.heroImage}" />
	{/if}
</svelte:head>

<SiteHeader title={settings.siteTitle} mode="overlay" />

<main>
	<section class="hero container" class:has-image={!!settings.heroImage}>
		<div class="grid-guides" aria-hidden="true">
			{#each { length: 12 } as _, i (i)}<span></span>{/each}
		</div>
		<div class="hero-grid grid-12">
			<p class="hero-meta">
				<span class="sec-no">00</span>
				<span class="mono-label">Index</span>
				<span class="mono-label hide-sm">{plural(galleryCount, 'gallery', 'galleries')}</span>
				<a class="mono-label jump" href={featured ? '#work' : '/galleries'}>View Work ↓</a>
			</p>
			<h1>
				{#each heroLines as line, i (i)}
					<span class="line" style:animation-delay="{40 + i * 60}ms">{line}</span>
				{/each}
			</h1>
			<div class="hero-text fade-up" style:animation-delay="240ms">
				{#if settings.heroDescription}
					<p class="hero-description">{settings.heroDescription}</p>
				{/if}
				<a class="btn btn-solid" href={featured ? '#work' : '/galleries'}>
					View Work <ArrowRight size={14} />
				</a>
			</div>
			{#if settings.heroImage}
				<figure class="hero-figure">
					<div class="hero-image">
						<img
							src="/site/hero/large?v={settings.heroImage}"
							srcset="/site/hero/small?v={settings.heroImage} 1200w, /site/hero/large?v={settings.heroImage} 2400w"
							sizes="(min-width: 960px) 66vw, 100vw"
							alt=""
							fetchpriority="high"
						/>
					</div>
					<figcaption class="mono-label">
						<span>Fig. 00</span>
						<span>{settings.siteTitle}</span>
					</figcaption>
				</figure>
			{/if}
		</div>
	</section>

	{#if featured}
		<section id="work" class="featured container">
			<header class="sec-head">
				<span class="sec-no">01 — Featured</span>
				<h2>{featured.title}</h2>
				{#if featured.total}
					<p class="sec-aside mono-label">{plural(featured.total, 'photo')}</p>
				{/if}
			</header>

			<div class="featured-body grid-12">
				{#if featured.descriptionHtml}
					<div class="prose featured-text">{@html featured.descriptionHtml}</div>
				{/if}

				<div class="featured-media" class:wide={!featured.descriptionHtml}>
					{#if featured.locked}
						<a class="locked-feature" href="/{featured.slug}">
							{#if featured.cover}
								<Img src={mediaUrl(featured.cover, 'medium')} alt="" />
							{/if}
							<span class="locked-label"
								><Lock size={15} strokeWidth={1.5} /> Password protected — enter to view</span
							>
						</a>
					{:else if featured.photos.length}
						<PhotoGallery
							photos={featured.photos}
							layout={featured.layout}
							href={photoHref}
							onopen={openLightbox}
						/>
					{:else}
						<p class="empty">Photos from this collection will appear here soon.</p>
					{/if}

					<div class="section-foot">
						<a class="btn" href="/{featured.slug}">
							View Full Collection
							{#if featured.total}<span class="count">{featured.total}</span>{/if}
							<ArrowRight size={14} />
						</a>
					</div>
				</div>
			</div>
		</section>
	{/if}

	{#if data.albums.length}
		<section class="explore container" id={featured ? undefined : 'work'}>
			<header class="sec-head">
				<span class="sec-no">{featured ? '02' : '01'} — Index</span>
				<h2>Recent galleries</h2>
				<a class="sec-aside link" href="/galleries">View All Galleries <ArrowRight size={13} /></a>
			</header>
			<AlbumIndex albums={data.albums} />
		</section>
	{/if}

	<section id="about" class="about container">
		<header class="sec-head">
			<span class="sec-no"
				>{indexNumber(1 + (featured ? 1 : 0) + (data.albums.length ? 1 : 0))} — About</span
			>
			<h2>{settings.aboutTitle}</h2>
		</header>
		<div class="about-body grid-12">
			<div class="about-text">
				{#each paragraphs(settings.aboutText) as paragraph, i (i)}
					<p>{paragraph}</p>
				{/each}
			</div>
			{#if hasContact}
				<dl class="contact">
					{#if settings.contactEmail}
						<div>
							<dt class="mono-label"><Mail size={13} strokeWidth={1.5} /> Email</dt>
							<dd><a href="mailto:{settings.contactEmail}">{settings.contactEmail}</a></dd>
						</div>
					{/if}
					{#if settings.contactPhone}
						<div>
							<dt class="mono-label"><Phone size={13} strokeWidth={1.5} /> Phone</dt>
							<dd>
								<a href="tel:{settings.contactPhone.replace(/[^\d+]/g, '')}"
									>{settings.contactPhone}</a
								>
							</dd>
						</div>
					{/if}
				</dl>
			{/if}
		</div>
	</section>
</main>

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

{#if lightboxIndex >= 0}
	<Lightbox
		photos={featuredPhotos}
		index={lightboxIndex}
		total={featuredPhotos.length}
		onclose={() => history.back()}
		onnavigate={navigateLightbox}
	/>
{/if}

<style>
	/* ---- hero: the headline is set on the grid; the photo sits in a cell of it */

	.hero {
		position: relative;
		padding-top: clamp(1.25rem, 3vw, 2.5rem);
		padding-bottom: clamp(3rem, 7vw, 6rem);
	}

	.hero .grid-guides {
		left: var(--gutter);
		right: var(--gutter);
	}

	.hero-grid {
		position: relative;
		row-gap: clamp(1.5rem, 3.5vw, 3rem);
	}

	.hero-meta {
		display: grid;
		grid-template-columns: subgrid;
		align-items: baseline;
		padding-top: 0.6rem;
		border-top: var(--rule);
		animation: index-wipe 0.4s var(--ease) both;
	}

	.hero-meta > :nth-child(1) {
		grid-column: 1 / span 2;
	}
	.hero-meta > :nth-child(2) {
		grid-column: 3 / span 3;
	}
	.hero-meta > :nth-child(3) {
		grid-column: 6 / span 4;
	}
	.hero-meta > :nth-child(4) {
		grid-column: 10 / -1;
		justify-self: end;
	}

	.jump {
		text-decoration: none;
		color: var(--text);
	}

	.jump:hover {
		background: var(--ink);
		color: var(--bg);
	}

	@media (max-width: 719px) {
		.hero-meta > :nth-child(1) {
			grid-column: 1 / span 3;
		}
		.hero-meta > :nth-child(2) {
			grid-column: 4 / span 4;
		}
		.hero-meta > :nth-child(4) {
			grid-column: 8 / -1;
		}
		.hide-sm {
			display: none;
		}
	}

	h1 {
		font-size: clamp(2.6rem, 10.4vw, 11.5rem);
		font-weight: 650;
		line-height: 0.86;
		letter-spacing: -0.055em;
		/* Optical alignment: pull the heavy cap back onto the grid line. */
		margin-left: -0.04em;
	}

	.line {
		display: block;
		padding-bottom: 0.04em;
		animation: index-wipe 0.45s var(--ease) both;
	}

	.hero-text {
		display: grid;
		align-content: start;
		justify-items: start;
		gap: 1.5rem;
	}

	@media (min-width: 960px) {
		.has-image .hero-text {
			grid-column: 1 / span 4;
			align-self: start;
			position: sticky;
			top: calc(var(--header-height) + 1.5rem);
		}

		.hero:not(.has-image) .hero-text {
			grid-column: 7 / -1;
		}
	}

	.hero-description {
		max-width: 34ch;
		font-size: clamp(1.1rem, 1.5vw, 1.35rem);
		font-weight: 450;
		line-height: 1.3;
		letter-spacing: -0.015em;
	}

	.hero-figure {
		display: grid;
		gap: 0.6rem;
		margin: 0;
	}

	@media (min-width: 960px) {
		.hero-figure {
			grid-column: 5 / -1;
		}
	}

	.hero-image {
		aspect-ratio: 3 / 2;
		overflow: hidden;
		background: var(--placeholder);
	}

	.hero-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: index-wipe 0.6s var(--ease) 0.15s both;
	}

	figcaption {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	/* ---- sections */

	section.featured,
	section.explore,
	.about {
		padding-top: clamp(3.5rem, 8vw, 7rem);
		scroll-margin-top: var(--header-height);
	}

	.featured-body {
		row-gap: 2rem;
	}

	@media (min-width: 960px) {
		.featured-text {
			grid-column: 1 / span 3;
			position: sticky;
			top: calc(var(--header-height) + 1.5rem);
			align-self: start;
			font-size: 0.95rem;
		}

		.featured-media {
			grid-column: 4 / -1;
		}

		.featured-media.wide {
			grid-column: 1 / -1;
		}
	}

	.section-foot {
		display: flex;
		justify-content: flex-end;
		margin-top: 1.5rem;
	}

	.count {
		padding-left: 0.6rem;
		border-left: 1px solid currentColor;
		font-variant-numeric: tabular-nums;
	}

	.empty {
		padding: 4rem 1rem;
		border-block: 1px solid var(--border);
		color: var(--text-subtle);
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.locked-feature {
		position: relative;
		display: block;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		background: var(--placeholder);
		text-decoration: none;
	}

	.locked-feature :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(10px) grayscale(0.4);
		transform: scale(1.06);
	}

	.locked-label {
		position: absolute;
		left: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.75rem 1rem;
		background: var(--bg);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		text-transform: uppercase;
		transition:
			background-color var(--fast) var(--ease),
			color var(--fast) var(--ease);
	}

	.locked-feature:hover .locked-label {
		background: var(--ink);
		color: var(--bg);
	}

	/* ---- about */

	.about-body {
		row-gap: 2.5rem;
	}

	.about-text {
		display: grid;
		gap: 1.1rem;
		align-content: start;
		max-width: 60ch;
		font-size: 1.02rem;
		line-height: 1.6;
		color: var(--text-muted);
	}

	.about-text p:first-child {
		max-width: 26ch;
		font-size: clamp(1.45rem, 2.8vw, 2.4rem);
		font-weight: 500;
		line-height: 1.08;
		letter-spacing: -0.035em;
		color: var(--text);
	}

	@media (min-width: 960px) {
		.about-text {
			grid-column: 3 / span 7;
		}

		.contact {
			grid-column: 10 / -1;
		}
	}

	.contact {
		display: grid;
		align-content: start;
		margin: 0;
	}

	.contact > div {
		display: grid;
		gap: 0.3rem;
		padding-block: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.contact > div:first-child {
		border-top-color: var(--text);
	}

	.contact dt {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.contact dd {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.contact a {
		font-size: 1.05rem;
		font-weight: 500;
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 4px;
	}

	.contact a:hover {
		text-decoration-color: currentColor;
	}
</style>
