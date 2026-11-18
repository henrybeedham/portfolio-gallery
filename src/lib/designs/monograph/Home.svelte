<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import PhotoGallery from '#lib/components/PhotoGallery.svelte';
	import AlbumCard from './AlbumCard.svelte';
	import ContentsList from './ContentsList.svelte';
	import Img from '#lib/components/Img.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import { mediaUrl, paragraphs, plural, viewQuery } from '#lib/utils.js';
	import { roman } from './format.js';
	import type { PhotoItem } from '#lib/types.js';
	import type { PageProps } from '../../../routes/$types';

	let { data }: PageProps = $props();

	const settings = $derived(data.settings);
	const heroLines = $derived(settings.heroTitle.split('\n').filter((line) => line.trim()));
	const featured = $derived(data.featured);
	const featuredPhotos = $derived(featured?.photos ?? []);
	const hasContact = $derived(
		settings.showContactOnHome && !!(settings.contactEmail || settings.contactPhone)
	);

	// Sections are numbered like chapters, so the numerals follow whichever sections are shown.
	const numerals = $derived.by(() => {
		let n = 0;
		return {
			featured: featured ? roman(++n) : '',
			albums: data.albums.length ? roman(++n) : '',
			about: roman(++n)
		};
	});

	// The table of contents previews the hovered (or focused) gallery's cover beside it.
	let previewIndex = $state(0);
	const previewAlbum = $derived(data.albums[previewIndex] ?? data.albums[0]);

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
	<section class="frontispiece container" class:has-image={!!settings.heroImage}>
		{#if settings.heroImage}
			<figure class="hero mat" aria-hidden="true">
				<div class="print">
					<img
						src="/site/hero/large?v={settings.heroImage}"
						srcset="/site/hero/small?v={settings.heroImage} 1200w, /site/hero/large?v={settings.heroImage} 2400w"
						sizes="(min-width: 1200px) 1100px, 92vw"
						alt=""
						fetchpriority="high"
					/>
				</div>
			</figure>
		{/if}
		<div class="title-page">
			<h1>
				{#each heroLines as line, i (i)}
					<span class="line" style:animation-delay="{0.35 + i * 0.25}s">{line}</span>
				{/each}
			</h1>
			<div class="ornament fade-in" style:animation-delay="0.9s" aria-hidden="true"></div>
			{#if settings.heroDescription}
				<p class="lede fade-in" style:animation-delay="1s">{settings.heroDescription}</p>
			{/if}
			<a class="btn fade-in" style:animation-delay="1.15s" href={featured ? '#work' : '/galleries'}>
				View Work {#if featured}<ArrowDown size={14} strokeWidth={1.5} />{/if}
			</a>
		</div>
	</section>

	{#if featured}
		<section id="work" class="featured container">
			<header class="section-title">
				<span class="numeral">{numerals.featured}</span>
				<p class="eyebrow">Featured collection</p>
				<h2>{featured.title}</h2>
				<div class="ornament" aria-hidden="true"></div>
				{#if featured.descriptionHtml}
					<div class="prose description">{@html featured.descriptionHtml}</div>
				{/if}
			</header>

			{#if featured.locked}
				<a class="locked-feature mat" href="/{featured.slug}">
					<div class="print">
						{#if featured.cover}
							<Img src={mediaUrl(featured.cover, 'medium')} alt="" />
						{/if}
					</div>
					<span class="locked-label">
						<Lock size={15} strokeWidth={1.5} />
						<span class="sc">A private collection</span>
						<em>Enter the password to view</em>
					</span>
				</a>
			{:else if featured.photos.length}
				<PhotoGallery
					photos={featured.photos}
					layout={featured.layout}
					href={photoHref}
					onopen={openLightbox}
				/>
			{:else}
				<p class="empty">Photographs from this collection will appear here soon.</p>
			{/if}

			<div class="section-foot">
				<a class="btn" href="/{featured.slug}">
					View Full Collection
					{#if featured.total}<span class="count">({featured.total})</span>{/if}
				</a>
			</div>
		</section>
	{/if}

	{#if data.albums.length}
		<section class="contents container" id={featured ? undefined : 'work'}>
			<header class="section-title">
				<span class="numeral">{numerals.albums}</span>
				<p class="eyebrow">Contents</p>
				<h2>Recent Galleries</h2>
				<div class="ornament" aria-hidden="true"></div>
			</header>

			<div class="toc-layout">
				<ContentsList
					albums={data.albums}
					current={previewAlbum?.id}
					onpreview={(i) => (previewIndex = i)}
				/>

				{#if previewAlbum}
					<aside class="preview" aria-hidden="true">
						{#key previewAlbum.id}
							<div class="preview-card">
								<AlbumCard album={previewAlbum} number={previewIndex + 1} eager />
							</div>
						{/key}
					</aside>
				{/if}
			</div>

			<div class="section-foot">
				<a class="btn" href="/galleries">View All Galleries</a>
			</div>
		</section>
	{/if}

	<section id="about" class="about container">
		<header class="section-title">
			<span class="numeral">{numerals.about}</span>
			<p class="eyebrow">{settings.siteTitle}</p>
			<h2>{settings.aboutTitle}</h2>
			<div class="ornament" aria-hidden="true"></div>
		</header>
		<div class="about-body">
			{#each paragraphs(settings.aboutText) as paragraph, i (i)}
				<p>{paragraph}</p>
			{/each}
		</div>
		{#if hasContact}
			<div class="contact">
				<p class="eyebrow">Correspondence</p>
				<ul>
					{#if settings.contactEmail}
						<li>
							<Mail size={14} strokeWidth={1.5} />
							<a href="mailto:{settings.contactEmail}">{settings.contactEmail}</a>
						</li>
					{/if}
					{#if settings.contactPhone}
						<li>
							<Phone size={14} strokeWidth={1.5} />
							<a href="tel:{settings.contactPhone.replace(/[^\d+]/g, '')}"
								>{settings.contactPhone}</a
							>
						</li>
					{/if}
				</ul>
			</div>
		{/if}
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
	/* ---------------------------------------------------------- frontispiece */

	.frontispiece {
		display: grid;
		justify-items: center;
		gap: clamp(2rem, 5vw, 3.5rem);
		padding-top: clamp(2.5rem, 6vw, 4.5rem);
	}

	.frontispiece:not(.has-image) {
		padding-top: clamp(4rem, 12vw, 9rem);
	}

	.hero {
		width: min(100%, 1100px);
		margin: 0;
		--mat-pad: clamp(0.9rem, 3.5vw, 3rem);
		animation: mono-fade 1.6s var(--ease) both;
	}

	.hero .print {
		aspect-ratio: 3 / 2;
		overflow: hidden;
	}

	@media (max-width: 640px) {
		.hero .print {
			aspect-ratio: 4 / 5;
		}
	}

	.hero img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.title-page {
		display: grid;
		justify-items: center;
		gap: 1.5rem;
		text-align: center;
	}

	h1 {
		font-size: clamp(2.5rem, 6.6vw, 5.4rem);
		font-weight: 400;
		line-height: 1.04;
		max-width: 18ch;
	}

	.line {
		display: block;
		animation: mono-fade 1.2s var(--ease) both;
	}

	.line:nth-child(even) {
		font-style: italic;
	}

	.title-page .lede {
		max-width: 30rem;
	}

	/* --------------------------------------------------------------- sections */

	section.featured,
	section.contents,
	section.about {
		padding-top: clamp(5rem, 12vw, 9.5rem);
	}

	.section-title {
		margin-bottom: clamp(2.5rem, 5vw, 4rem);
	}

	.description {
		max-width: var(--measure);
		margin-top: 0.75rem;
		font-style: italic;
		text-align: center;
	}

	.section-foot {
		display: flex;
		justify-content: center;
		margin-top: clamp(3rem, 6vw, 4.5rem);
	}

	.count {
		opacity: 0.6;
	}

	.empty {
		padding: 4rem 1rem;
		text-align: center;
		font-style: italic;
		color: var(--text-subtle);
		border-block: 1px solid var(--border);
	}

	.locked-feature {
		position: relative;
		display: block;
		max-width: 880px;
		margin-inline: auto;
		text-decoration: none;
	}

	.locked-feature .print {
		aspect-ratio: 16 / 9;
		overflow: hidden;
	}

	.locked-feature :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(10px);
		transform: scale(1.08);
	}

	.locked-label {
		position: absolute;
		inset: var(--mat-pad);
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.4rem;
		text-align: center;
		background: color-mix(in srgb, var(--bg-elevated) 55%, transparent);
	}

	.locked-label .sc {
		font-size: 1.1rem;
	}

	.locked-label em {
		color: var(--text-muted);
	}

	/* ------------------------------------------------------- table of contents */

	.toc-layout {
		display: grid;
		gap: 3rem;
		max-width: 1080px;
		margin-inline: auto;
	}

	@media (min-width: 900px) {
		.toc-layout {
			grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
			gap: clamp(3rem, 6vw, 6rem);
			align-items: start;
		}
	}

	.preview {
		position: sticky;
		top: 5rem;
	}

	.preview-card {
		animation: mono-fade 0.8s var(--ease) both;
	}

	@media (max-width: 899px) {
		.preview {
			display: none;
		}
	}

	/* ------------------------------------------------------------------ about */

	.about {
		scroll-margin-top: 3.5rem;
	}

	.about-body {
		display: grid;
		gap: 1.1rem;
		max-width: 36rem;
		margin-inline: auto;
		font-size: clamp(1.08rem, 1.4vw, 1.2rem);
		line-height: 1.75;
		color: var(--text-muted);
		hyphens: auto;
	}

	@media (min-width: 560px) {
		.about-body {
			text-align: justify;
		}
	}

	.about-body p:first-child {
		color: var(--text);
	}

	/* A drop capital opens the text. */
	.about-body p:first-child::first-letter {
		float: left;
		margin: 0.06em 0.12em 0 0;
		font-family: var(--font-display);
		font-size: 4.1em;
		font-weight: 500;
		line-height: 0.8;
		color: var(--highlight, var(--text));
	}

	.contact {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		max-width: 36rem;
		margin: 2.5rem auto 0;
		padding-top: 2rem;
		border-top: 1px solid var(--border);
		text-align: center;
	}

	.contact ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
		justify-items: center;
	}

	.contact li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--text-subtle);
	}

	.contact a {
		font-style: italic;
		font-size: 1.1rem;
		color: var(--text);
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 4px;
		overflow-wrap: anywhere;
		transition: text-decoration-color 0.5s var(--ease);
	}

	.contact a:hover {
		text-decoration-color: currentColor;
	}

	#work {
		scroll-margin-top: 1.5rem;
	}
</style>
