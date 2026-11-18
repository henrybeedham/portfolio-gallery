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
	import Roll from './Roll.svelte';
	import Img from '#lib/components/Img.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import { mediaUrl, paragraphs, viewQuery } from '#lib/utils.js';
	import { formatStampDate, frameNo } from './helpers.js';
	import type { PhotoItem } from '#lib/types.js';
	import type { PageProps } from '../../../routes/$types';

	let { data }: PageProps = $props();

	const settings = $derived(data.settings);
	const heroLines = $derived(settings.heroTitle.split('\n').filter((line) => line.trim()));
	const featured = $derived(data.featured);
	const featuredPhotos = $derived(featured?.photos ?? []);
	const latest = $derived(
		data.albums.reduce<string | null>(
			(max, album) => (album.date && (!max || album.date > max) ? album.date : max),
			null
		)
	);
	const caption = $derived(
		[
			featured ? { label: 'Featured', value: featured.title } : null,
			featured && !featured.locked ? { label: 'Frames', value: String(featured.total) } : null,
			data.albums.length ? { label: 'Recent rolls', value: frameNo(data.albums.length) } : null,
			latest ? { label: 'Latest', value: formatStampDate(latest) } : null
		].filter((row) => row !== null)
	);
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

<SiteHeader title={settings.siteTitle} />

<main>
	<section class="hero container" class:has-image={!!settings.heroImage}>
		{#if settings.heroImage}
			<div class="hero-frame fade-up">
				<span class="sprockets" aria-hidden="true"></span>
				<div class="hero-window">
					<img
						src="/site/hero/large?v={settings.heroImage}"
						srcset="/site/hero/small?v={settings.heroImage} 1200w, /site/hero/large?v={settings.heroImage} 2400w"
						sizes="(min-width: 1000px) 60vw, 100vw"
						alt=""
						fetchpriority="high"
					/>
				</div>
				<div class="rebate" aria-hidden="true">
					<span class="edge">00</span>
					<span class="edge hide-sm">{settings.siteTitle}</span>
					<span class="edge">▸ 00A</span>
				</div>
				<span class="sprockets" aria-hidden="true"></span>
			</div>
		{/if}
		<div class="hero-copy">
			<p class="eyebrow">Frame 00 — Enlargement</p>
			<h1 class="fade-up">
				{#each heroLines as line, i (i)}
					<span class="line">{line}</span>
				{/each}
			</h1>
			{#if settings.heroDescription}
				<p class="hero-description">{settings.heroDescription}</p>
			{/if}
			{#if caption.length}
				<dl class="tech">
					{#each caption as row (row.label)}
						<div>
							<dt>{row.label}</dt>
							<dd>{row.value}</dd>
						</div>
					{/each}
				</dl>
			{/if}
			<a class="btn btn-solid" href={featured ? '#work' : '/galleries'}>
				View Work <ArrowRight size={14} />
			</a>
		</div>
	</section>

	{#if featured}
		<section id="work" class="featured container">
			<div class="sheet-head">
				<span class="sheet-no" aria-hidden="true">01</span>
				<p class="eyebrow">Contact sheet — featured collection</p>
				<h2>{featured.title}</h2>
			</div>
			{#if featured.descriptionHtml}
				<div class="prose lede">{@html featured.descriptionHtml}</div>
			{/if}

			{#if featured.locked}
				<a class="locked-feature" href="/{featured.slug}">
					{#if featured.cover}
						<Img src={mediaUrl(featured.cover, 'medium')} alt="" />
					{/if}
					<span class="locked-label">
						<span class="stamp tilt"><Lock size={13} /> Sealed — Enter to View</span>
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
				<p class="empty">Photos from this collection will appear here soon.</p>
			{/if}

			<div class="section-foot">
				<span class="edge">
					{#if featured.total && featured.photos.length < featured.total}
						Showing {featured.photos.length} of {featured.total} frames
					{:else}End of sheet{/if}
				</span>
				<a class="btn" href="/{featured.slug}">
					View Full Collection
					{#if featured.total}<span class="count">({featured.total})</span>{/if}
					<ArrowRight size={14} />
				</a>
			</div>
		</section>
	{/if}

	{#if data.albums.length}
		<section class="explore container" id={featured ? undefined : 'work'}>
			<div class="sheet-head">
				<span class="sheet-no" aria-hidden="true">02</span>
				<p class="eyebrow">Explore more</p>
				<h2>Recent galleries</h2>
			</div>
			<div class="cards">
				{#each data.albums as album, i (album.id)}
					<Roll {album} index={i} />
				{/each}
			</div>
			<div class="section-foot">
				<span class="edge">{frameNo(data.albums.length)} rolls on this sheet</span>
				<a class="btn" href="/galleries">View All Galleries <ArrowRight size={14} /></a>
			</div>
		</section>
	{/if}

	<section id="about" class="about container">
		<div class="sheet-head">
			<span class="sheet-no" aria-hidden="true">03</span>
			<p class="eyebrow">{settings.siteTitle}</p>
			<h2>{settings.aboutTitle}</h2>
		</div>
		<div class="about-body">
			{#each paragraphs(settings.aboutText) as paragraph, i (i)}
				<p>{paragraph}</p>
			{/each}
		</div>
		{#if hasContact}
			<ul class="contact">
				{#if settings.contactEmail}
					<li>
						<span class="contact-label"><Mail size={14} strokeWidth={1.5} /> Email</span>
						<a href="mailto:{settings.contactEmail}">{settings.contactEmail}</a>
					</li>
				{/if}
				{#if settings.contactPhone}
					<li>
						<span class="contact-label"><Phone size={14} strokeWidth={1.5} /> Phone</span>
						<a href="tel:{settings.contactPhone.replace(/[^\d+]/g, '')}">{settings.contactPhone}</a>
					</li>
				{/if}
			</ul>
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
	/* ---- hero: one enlarged frame beside its caption */

	.hero {
		display: grid;
		gap: clamp(1.75rem, 4vw, 3rem);
		padding-top: clamp(1.5rem, 4vw, 3rem);
		align-items: center;
	}

	@media (min-width: 1000px) {
		.hero.has-image {
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
		}
	}

	.hero:not(.has-image) {
		padding-top: clamp(3rem, 10vw, 7rem);
	}

	.hero-frame {
		margin: 0;
		display: grid;
		padding-inline: clamp(6px, 1vw, 12px);
		background: var(--film);
	}

	.hero-frame .sprockets {
		margin-inline: calc(-1 * clamp(6px, 1vw, 12px));
		height: 16px;
		background-size:
			100% 8px,
			auto;
	}

	.hero-window {
		aspect-ratio: 3 / 2;
		overflow: hidden;
		background: var(--placeholder);
	}

	.hero-window img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.rebate {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		height: 24px;
	}

	.hero-copy {
		display: grid;
		justify-items: start;
		gap: 1.25rem;
		padding-top: 1rem;
		border-top: var(--rule) solid var(--rule-color);
	}

	h1 {
		font-size: clamp(2.6rem, 5.4vw, 5.6rem);
		line-height: 0.92;
	}

	.hero:not(.has-image) h1 {
		font-size: clamp(3rem, 9vw, 8rem);
	}

	.line {
		display: block;
	}

	.line:nth-child(even) {
		font-weight: 300;
	}

	.hero-description {
		max-width: 46ch;
		font-family: var(--font-sans);
		font-size: clamp(0.98rem, 1.3vw, 1.1rem);
		line-height: 1.6;
		color: var(--text-muted);
	}

	.tech {
		display: grid;
		width: 100%;
		margin: 0;
		border-top: 1px solid var(--border-strong);
	}

	.tech div {
		display: grid;
		grid-template-columns: 9.5rem minmax(0, 1fr);
		gap: 1rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--border);
		font-size: 0.78rem;
	}

	.tech dt {
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-subtle);
	}

	.tech dd {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ---- sections */

	section.featured,
	section.explore,
	.about {
		padding-top: clamp(4rem, 9vw, 7rem);
	}

	.sheet-head {
		margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
	}

	.sheet-head h2 {
		font-size: clamp(2rem, 4.6vw, 3.8rem);
	}

	.lede {
		margin: -0.5rem 0 clamp(1.5rem, 3vw, 2.5rem);
	}

	.section-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: clamp(1.5rem, 3vw, 2.5rem);
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.count {
		opacity: 0.6;
	}

	.empty {
		padding: 4rem 1rem;
		text-align: center;
		color: var(--text-subtle);
		border: 1px dashed var(--border-strong);
	}

	.locked-feature {
		position: relative;
		display: block;
		aspect-ratio: 16 / 7;
		overflow: hidden;
		background: var(--placeholder);
		text-decoration: none;
		border: 6px solid var(--film);
	}

	.locked-feature :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(8px) grayscale(0.6);
		transform: scale(1.05);
	}

	.locked-label {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--bg) 40%, transparent);
	}

	.locked-label .stamp {
		padding: 0.5rem 0.9rem;
		font-size: 0.78rem;
		background: var(--bg);
	}

	.cards {
		display: grid;
		gap: clamp(2rem, 4vw, 3rem) clamp(1.25rem, 3vw, 2.5rem);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
	}

	/* ---- about */

	.about {
		display: grid;
		gap: 0 4rem;
		scroll-margin-top: var(--header-height);
	}

	@media (min-width: 900px) {
		.about {
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
		}

		.about .sheet-head {
			grid-column: 1 / -1;
		}
	}

	.about-body {
		display: grid;
		gap: 1.1rem;
		align-content: start;
		font-family: var(--font-sans);
		font-size: clamp(1rem, 1.3vw, 1.1rem);
		line-height: 1.75;
		color: var(--text-muted);
		max-width: 62ch;
	}

	.about-body p:first-child {
		font-size: clamp(1.25rem, 2.1vw, 1.6rem);
		font-weight: 400;
		line-height: 1.4;
		color: var(--text);
	}

	.contact {
		align-self: start;
		list-style: none;
		margin: 2rem 0 0;
		padding: 0;
		border-top: var(--rule) solid var(--rule-color);
	}

	@media (min-width: 900px) {
		.contact {
			margin-top: 0.5rem;
		}
	}

	.contact li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.25rem 1rem;
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--border);
	}

	.contact-label {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.contact a {
		text-decoration: none;
		color: var(--text);
		border-bottom: 1px solid var(--border-strong);
		overflow-wrap: anywhere;
	}

	.contact a:hover {
		border-color: var(--text);
	}

	#work {
		scroll-margin-top: calc(var(--header-height) + 1rem);
	}

	@media (max-width: 560px) {
		.hide-sm {
			display: none;
		}

		.tech div {
			grid-template-columns: 7.5rem minmax(0, 1fr);
		}
	}
</style>
