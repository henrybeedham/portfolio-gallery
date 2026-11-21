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
	import AlbumCard from '#lib/components/AlbumCard.svelte';
	import Img from '#lib/components/Img.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import { mediaUrl, paragraphs, viewQuery } from '#lib/utils.js';
	import type { PhotoItem } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const settings = $derived(data.settings);
	const heroLines = $derived(settings.heroTitle.split('\n').filter((line) => line.trim()));
	const featured = $derived(data.featured);
	const featuredPhotos = $derived(featured?.photos ?? []);
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
	<section class="hero" class:has-image={!!settings.heroImage}>
		{#if settings.heroImage}
			<div class="hero-image" aria-hidden="true">
				<img
					src="/site/hero/large?v={settings.heroImage}"
					srcset="/site/hero/small?v={settings.heroImage} 1200w, /site/hero/large?v={settings.heroImage} 2400w"
					sizes="100vw"
					alt=""
					fetchpriority="high"
				/>
			</div>
		{/if}
		<div class="hero-content container">
			<h1 class="fade-up">
				{#each heroLines as line, i (i)}
					<span class="line" style:animation-delay="{0.1 + i * 0.12}s">{line}</span>
				{/each}
			</h1>
			{#if settings.heroDescription}
				<p class="hero-description fade-up" style:animation-delay="0.45s">
					{settings.heroDescription}
				</p>
			{/if}
			<a
				class="btn btn-solid fade-up"
				style:animation-delay="0.6s"
				href={featured ? '#work' : '/galleries'}
			>
				View Work <ArrowRight size={14} />
			</a>
		</div>
	</section>

	{#if featured}
		<section id="work" class="featured container">
			<div class="section-head">
				<div>
					<p class="eyebrow">Featured collection</p>
					<h2>{featured.title}</h2>
				</div>
				{#if featured.descriptionHtml}
					<div class="prose">{@html featured.descriptionHtml}</div>
				{/if}
			</div>

			{#if featured.locked}
				<a class="locked-feature" href="/{featured.slug}">
					{#if featured.cover}
						<Img src={mediaUrl(featured.cover, 'medium')} alt="" />
					{/if}
					<span class="locked-label"><Lock size={16} /> Password protected — enter to view</span>
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
					{#if featured.total}<span class="count">({featured.total})</span>{/if}
				</a>
			</div>
		</section>
	{/if}

	{#if data.albums.length}
		<section class="explore container" id={featured ? undefined : 'work'}>
			<div class="section-head simple">
				<p class="eyebrow">Explore more</p>
				<h2>Recent galleries</h2>
			</div>
			<div class="cards">
				{#each data.albums as album (album.id)}
					<AlbumCard {album} />
				{/each}
			</div>
			<div class="section-foot">
				<a class="btn" href="/galleries">View All Galleries</a>
			</div>
		</section>
	{/if}

	<section id="about" class="about container">
		<div class="about-title">
			<p class="eyebrow">{settings.siteTitle}</p>
			<h2>{settings.aboutTitle}</h2>
		</div>
		<div class="about-body">
			{#each paragraphs(settings.aboutText) as paragraph, i (i)}
				<p>{paragraph}</p>
			{/each}
			{#if hasContact}
				<ul class="contact">
					{#if settings.contactEmail}
						<li>
							<Mail size={15} strokeWidth={1.5} />
							<a href="mailto:{settings.contactEmail}">{settings.contactEmail}</a>
						</li>
					{/if}
					{#if settings.contactPhone}
						<li>
							<Phone size={15} strokeWidth={1.5} />
							<a href="tel:{settings.contactPhone.replace(/[^\d+]/g, '')}"
								>{settings.contactPhone}</a
							>
						</li>
					{/if}
				</ul>
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
	.hero {
		position: relative;
		display: flex;
		align-items: flex-end;
		min-height: min(92svh, 980px);
		padding-top: calc(var(--header-height) + 3rem);
		padding-bottom: clamp(3.5rem, 9vw, 7.5rem);
		overflow: hidden;
	}

	.hero:not(.has-image) {
		min-height: min(78svh, 820px);
		border-bottom: 1px solid var(--border);
	}

	.hero-image {
		position: absolute;
		inset: 0;
	}

	.hero-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: hero-in 1.6s var(--ease) both;
	}

	@keyframes hero-in {
		from {
			opacity: 0;
			transform: scale(1.04);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.hero-image::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				100deg,
				color-mix(in srgb, var(--bg) 92%, transparent) 0%,
				color-mix(in srgb, var(--bg) 72%, transparent) 38%,
				color-mix(in srgb, var(--bg) 10%, transparent) 75%,
				transparent 100%
			),
			linear-gradient(
				to top,
				var(--bg) 0%,
				color-mix(in srgb, var(--bg) 70%, transparent) 14%,
				transparent 45%
			);
	}

	.hero-content {
		position: relative;
		display: grid;
		justify-items: start;
		gap: 1.75rem;
	}

	h1 {
		font-size: clamp(2.75rem, 7.4vw, 6.4rem);
		line-height: 1.02;
		letter-spacing: -0.02em;
		max-width: 14ch;
	}

	.line {
		display: block;
		animation: fade-up 0.9s var(--ease) both;
	}

	.line:nth-child(even) {
		font-style: italic;
	}

	.hero-description {
		max-width: 44ch;
		font-size: clamp(1rem, 1.4vw, 1.15rem);
		color: var(--text-muted);
	}

	section.featured,
	section.explore {
		padding-top: clamp(4.5rem, 10vw, 8.5rem);
	}

	.section-head {
		display: grid;
		gap: 1.5rem;
		margin-bottom: clamp(2rem, 4vw, 3.5rem);
	}

	@media (min-width: 900px) {
		.section-head:not(.simple) {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: end;
			gap: 4rem;
		}
	}

	.section-head h2 {
		font-size: clamp(2.1rem, 4.6vw, 3.6rem);
		margin-top: 0.75rem;
	}

	.section-foot {
		display: flex;
		justify-content: center;
		margin-top: clamp(2.5rem, 5vw, 4rem);
	}

	.count {
		opacity: 0.6;
	}

	.empty {
		padding: 4rem 1rem;
		text-align: center;
		color: var(--text-subtle);
		border: 1px solid var(--border);
	}

	.locked-feature {
		position: relative;
		display: block;
		aspect-ratio: 16 / 7;
		overflow: hidden;
		background: var(--placeholder);
		text-decoration: none;
	}

	.locked-feature :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(6px) brightness(0.9);
		transform: scale(1.05);
	}

	.locked-label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		font-size: 0.72rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		background: color-mix(in srgb, var(--bg) 35%, transparent);
	}

	.cards {
		display: grid;
		gap: clamp(1.5rem, 3vw, 2.5rem) clamp(1rem, 2.5vw, 2rem);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
	}

	.about {
		display: grid;
		gap: 2rem;
		padding-top: clamp(5rem, 12vw, 10rem);
		scroll-margin-top: var(--header-height);
	}

	@media (min-width: 900px) {
		.about {
			grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
			gap: 4rem;
		}
	}

	.about h2 {
		font-size: clamp(2.4rem, 5vw, 4rem);
		margin-top: 0.75rem;
	}

	.about-body {
		display: grid;
		gap: 1.25rem;
		align-content: start;
		font-size: clamp(1.02rem, 1.4vw, 1.18rem);
		line-height: 1.8;
		color: var(--text-muted);
		max-width: 62ch;
	}

	.about-body p:first-child {
		font-family: var(--font-serif);
		font-size: clamp(1.3rem, 2.2vw, 1.7rem);
		line-height: 1.45;
		color: var(--text);
	}

	.contact {
		list-style: none;
		margin: 1rem 0 0;
		padding: 1.5rem 0 0;
		border-top: 1px solid var(--border);
		display: grid;
		gap: 0.75rem;
		font-size: 0.95rem;
	}

	.contact li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.contact a {
		text-decoration: none;
		color: var(--text);
		border-bottom: 1px solid var(--border-strong);
	}

	.contact a:hover {
		border-color: var(--text);
	}

	#work {
		scroll-margin-top: calc(var(--header-height) - 1rem);
	}
</style>
