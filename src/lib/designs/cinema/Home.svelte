<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import Play from '@lucide/svelte/icons/play';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import CoverMosaic from './CoverMosaic.svelte';
	import Img from '#lib/components/Img.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import { formatDuration, mediaUrl, paragraphs, plural, viewQuery } from '#lib/utils.js';
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

	function onFrameClick(event: MouseEvent, index: number) {
		// Let the browser handle new-tab / new-window clicks.
		if (event.metaKey || event.ctrlKey || event.button !== 0) return;
		event.preventDefault();
		openLightbox(index);
	}

	/* --------------------------------------------------------------- filmstrip */

	let strip = $state<HTMLElement>();
	let atStart = $state(true);
	let atEnd = $state(false);
	let progress = $state(0);

	function measure() {
		if (!strip) return;
		const max = strip.scrollWidth - strip.clientWidth;
		atStart = strip.scrollLeft <= 4;
		atEnd = strip.scrollLeft >= max - 4;
		progress = max > 0 ? strip.scrollLeft / max : 1;
	}

	function scrollStrip(direction: number) {
		strip?.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' });
	}

	$effect(() => {
		if (!strip) return;
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(strip);
		return () => observer.disconnect();
	});

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
		<div class="hero-content">
			<h1>
				{#each heroLines as line, i (i)}
					<span class="line" style:animation-delay="{0.3 + i * 0.16}s">{line}</span>
				{/each}
			</h1>
			{#if settings.heroDescription}
				<p class="hero-description fade-up" style:animation-delay="0.75s">
					{settings.heroDescription}
				</p>
			{/if}
			<div class="hero-actions fade-up" style:animation-delay="0.95s">
				<a class="btn btn-solid" href={featured ? '#work' : '/galleries'}>
					View Work <ArrowRight size={15} />
				</a>
				{#if featured}
					<a class="btn btn-glass" href="/galleries">All Galleries</a>
				{/if}
			</div>
		</div>
		<span class="scroll-cue" aria-hidden="true"></span>
	</section>

	{#if featured}
		<section id="work" class="featured">
			<header class="section-head container">
				<div class="heading">
					<p class="eyebrow">Featured collection</p>
					<h2>{featured.title}</h2>
				</div>
				<div class="aside">
					{#if featured.descriptionHtml}
						<div class="prose">{@html featured.descriptionHtml}</div>
					{/if}
					<a class="btn" href="/{featured.slug}">
						View Full Collection
						{#if featured.total}<span class="count">{featured.total}</span>{/if}
						<ArrowRight size={15} />
					</a>
				</div>
			</header>

			{#if featured.locked}
				<a class="locked-feature" href="/{featured.slug}">
					{#if featured.cover}
						<Img src={mediaUrl(featured.cover, 'medium')} alt="" />
					{/if}
					<span class="locked-label">
						<span class="lock-icon"><Lock size={18} strokeWidth={1.5} /></span>
						Password protected — enter to view
					</span>
				</a>
			{:else if featuredPhotos.length}
				<div class="filmstrip">
					<ul
						class="strip"
						bind:this={strip}
						onscroll={measure}
						aria-label="{featured.title}: featured photos"
					>
						{#each featuredPhotos as photo, index (photo.id)}
							<li class="frame" style:--ar={photo.w && photo.h ? photo.w / photo.h : 1.5}>
								<a
									href={photoHref(photo)}
									onclick={(event) => onFrameClick(event, index)}
									aria-label="{photo.name}{photo.kind === 'video' ? ' (video)' : ''}"
									data-sveltekit-reset="false"
									data-sveltekit-preload-data="false"
								>
									<Img
										src={mediaUrl(photo, 'medium')}
										alt={photo.name}
										width={photo.w || undefined}
										height={photo.h || undefined}
										eager={index < 3}
									/>
									{#if photo.kind === 'video'}
										<span class="video" aria-hidden="true">
											<Play size={11} strokeWidth={2} />
											{formatDuration(photo.duration)}
										</span>
									{/if}
								</a>
							</li>
						{/each}
						<li class="frame end">
							<a href="/{featured.slug}">
								<span class="eyebrow">Continue</span>
								<span class="end-title">See all {plural(featured.total, 'photo')}</span>
								<ArrowRight size={22} strokeWidth={1.5} />
							</a>
						</li>
					</ul>
					<div class="strip-controls container">
						<span class="progress" aria-hidden="true">
							<span style:transform="scaleX({Math.max(0.06, progress)})"></span>
						</span>
						<div class="arrows">
							<button
								class="arrow"
								onclick={() => scrollStrip(-1)}
								disabled={atStart}
								aria-label="Scroll back"
							>
								<ChevronLeft size={20} strokeWidth={1.5} />
							</button>
							<button
								class="arrow"
								onclick={() => scrollStrip(1)}
								disabled={atEnd}
								aria-label="Scroll forward"
							>
								<ChevronRight size={20} strokeWidth={1.5} />
							</button>
						</div>
					</div>
				</div>
			{:else}
				<p class="empty container">Photos from this collection will appear here soon.</p>
			{/if}
		</section>
	{/if}

	{#if data.albums.length}
		<section class="explore" id={featured ? undefined : 'work'}>
			<header class="section-head simple container">
				<div class="heading">
					<p class="eyebrow">Explore more</p>
					<h2>Recent galleries</h2>
				</div>
				<a class="btn" href="/galleries">View All Galleries <ArrowRight size={15} /></a>
			</header>
			<CoverMosaic albums={data.albums} />
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
							<a class="btn" href="mailto:{settings.contactEmail}">
								<Mail size={15} strokeWidth={1.5} />
								{settings.contactEmail}
							</a>
						</li>
					{/if}
					{#if settings.contactPhone}
						<li>
							<a class="btn" href="tel:{settings.contactPhone.replace(/[^\d+]/g, '')}">
								<Phone size={15} strokeWidth={1.5} />
								{settings.contactPhone}
							</a>
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
	/* ---------------------------------------------------------------- hero */

	.hero {
		position: relative;
		display: grid;
		align-items: end;
		justify-items: center;
		min-height: 100svh;
		padding: calc(var(--header-height) + 2rem) var(--gutter) clamp(5rem, 12svh, 8.5rem);
		overflow: hidden;
		isolation: isolate;
	}

	.hero:not(.has-image) {
		min-height: min(86svh, 900px);
		align-items: center;
	}

	.hero-image {
		position: absolute;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		background: var(--placeholder);
	}

	.hero-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform-origin: 60% 40%;
		animation:
			hero-in 2.4s var(--ease) both,
			ken-burns 32s ease-in-out 2.4s infinite alternate;
	}

	@keyframes hero-in {
		from {
			opacity: 0;
			transform: scale(1.06);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	/* Gentle Ken Burns, hero only. Reduced motion stops it (app.css). */
	@keyframes ken-burns {
		from {
			transform: scale(1);
		}
		to {
			transform: scale(1.09) translate(-1.2%, 0.8%);
		}
	}

	.hero-image::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to bottom, var(--scrim-soft) 0%, transparent 22%),
			linear-gradient(
				to top,
				var(--bg) 0%,
				color-mix(in srgb, var(--bg) 82%, transparent) 16%,
				color-mix(in srgb, var(--bg) 30%, transparent) 42%,
				transparent 64%
			),
			radial-gradient(
				ellipse 120% 90% at 50% 40%,
				transparent 55%,
				color-mix(in srgb, var(--bg) 35%, transparent) 100%
			);
	}

	.hero-content {
		display: grid;
		justify-items: center;
		gap: clamp(1.25rem, 2.5vw, 1.75rem);
		max-width: 72rem;
		text-align: center;
	}

	h1 {
		font-size: clamp(3rem, 8.2vw, 8.6rem);
		font-weight: 500;
		line-height: 0.88;
		letter-spacing: -0.005em;
	}

	.line {
		display: block;
		animation: cinema-fade-up 1.4s var(--ease-slow) both;
	}

	.hero-description {
		max-width: 46ch;
		font-size: clamp(1rem, 1.4vw, 1.15rem);
		color: var(--text-muted);
	}

	.has-image .hero-description {
		color: var(--text);
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.6rem;
	}

	.scroll-cue {
		position: absolute;
		left: 50%;
		bottom: 1.5rem;
		width: 1px;
		height: clamp(2rem, 6svh, 3.5rem);
		background: color-mix(in srgb, var(--text) 25%, transparent);
		overflow: hidden;
	}

	.scroll-cue::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--text);
		animation: cue 2.8s var(--ease) 2s infinite;
		transform: translateY(-100%);
	}

	@keyframes cue {
		0% {
			transform: translateY(-100%);
		}
		60%,
		100% {
			transform: translateY(100%);
		}
	}

	/* ---------------------------------------------------------------- sections */

	section.featured,
	section.explore {
		padding-top: clamp(4.5rem, 10vw, 8rem);
	}

	.section-head {
		display: grid;
		gap: 1.5rem;
		margin-bottom: clamp(1.75rem, 3.5vw, 3rem);
	}

	@media (min-width: 900px) {
		.section-head {
			grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
			align-items: end;
			gap: 4rem;
		}

		.section-head.simple {
			grid-template-columns: minmax(0, 1fr) auto;
		}
	}

	.heading {
		display: grid;
		gap: 0.8rem;
	}

	.section-head h2 {
		font-size: clamp(2.6rem, 7vw, 6rem);
		line-height: 0.9;
	}

	.aside {
		display: grid;
		justify-items: start;
		gap: 1.5rem;
	}

	.section-head .btn {
		justify-self: start;
	}

	.count {
		padding: 0.1rem 0.45rem;
		border-radius: var(--pill);
		background: color-mix(in srgb, var(--text) 10%, transparent);
		font-size: 0.74rem;
		font-variant-numeric: tabular-nums;
	}

	.empty {
		padding-block: 4rem;
		text-align: center;
		color: var(--text-subtle);
	}

	/* ---------------------------------------------------------------- filmstrip */

	.filmstrip {
		--frame-h: clamp(240px, 64svh, 640px);
	}

	@media (max-width: 640px) {
		.filmstrip {
			--frame-h: clamp(220px, 58svh, 460px);
		}
	}

	.strip {
		display: flex;
		gap: var(--tile-gap);
		margin: 0;
		padding: 0 var(--gutter);
		list-style: none;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scroll-padding-inline: var(--gutter);
		scrollbar-width: none;
	}

	.strip::-webkit-scrollbar {
		display: none;
	}

	.frame {
		flex: none;
		height: var(--frame-h);
		aspect-ratio: var(--ar);
		max-width: calc(100vw - 2 * var(--gutter));
		scroll-snap-align: start;
		background: var(--placeholder);
		overflow: hidden;
	}

	.frame a {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		cursor: zoom-in;
	}

	.frame :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition:
			opacity 1s var(--ease),
			transform 1.8s var(--ease-slow),
			filter 1s var(--ease);
	}

	.frame a:hover :global(img.loaded) {
		transform: scale(1.03);
	}

	.frame.end {
		aspect-ratio: 3 / 4;
		background: var(--surface);
	}

	.frame.end a {
		display: grid;
		align-content: end;
		gap: 0.75rem;
		padding: clamp(1.25rem, 3vw, 2rem);
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.6s var(--ease);
	}

	.frame.end a:hover {
		background: var(--surface-strong);
	}

	.end-title {
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 3.5vw, 3rem);
		font-weight: 500;
		line-height: 0.95;
		text-transform: uppercase;
	}

	.video {
		position: absolute;
		left: 10px;
		bottom: 10px;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.55rem;
		border-radius: var(--pill);
		background: var(--glass);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		font-size: 0.72rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.strip-controls {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		margin-top: 1.25rem;
	}

	.progress {
		position: relative;
		flex: 1;
		height: 2px;
		background: var(--border);
		overflow: hidden;
	}

	.progress span {
		position: absolute;
		inset: 0;
		background: var(--emphasis);
		transform-origin: left;
		transition: transform 0.4s var(--ease);
	}

	.arrows {
		display: flex;
		gap: 0.4rem;
	}

	.arrow {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		background: none;
		cursor: pointer;
		transition:
			background-color 0.3s var(--ease),
			opacity 0.3s var(--ease);
	}

	.arrow:hover:not(:disabled) {
		background: color-mix(in srgb, var(--text) 8%, transparent);
	}

	.arrow:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.locked-feature {
		position: relative;
		display: block;
		height: clamp(260px, 56svh, 600px);
		overflow: hidden;
		background: var(--placeholder);
		text-decoration: none;
	}

	.locked-feature :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(14px) saturate(1.1);
		transform: scale(1.08);
	}

	.locked-label {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 1rem;
		padding: 1rem;
		text-align: center;
		font-family: var(--font-display);
		font-size: clamp(1.2rem, 2.6vw, 1.8rem);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		background: color-mix(in srgb, var(--bg) 45%, transparent);
	}

	.lock-icon {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: var(--glass);
		border: 1px solid var(--glass-border);
	}

	/* ---------------------------------------------------------------- about */

	.about {
		display: grid;
		gap: 2rem;
		padding-top: clamp(5rem, 12vw, 10rem);
		scroll-margin-top: var(--header-height);
	}

	@media (min-width: 900px) {
		.about {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			gap: 5rem;
		}
	}

	.about-title {
		display: grid;
		gap: 0.8rem;
		align-content: start;
	}

	.about h2 {
		font-size: clamp(2.8rem, 7vw, 6.5rem);
		line-height: 0.9;
	}

	.about-body {
		display: grid;
		gap: 1.25rem;
		align-content: start;
		font-size: clamp(1rem, 1.3vw, 1.1rem);
		line-height: 1.8;
		color: var(--text-muted);
		max-width: 60ch;
	}

	.about-body p:first-child {
		font-size: clamp(1.25rem, 2vw, 1.6rem);
		font-weight: 500;
		line-height: 1.45;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	.contact {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
	}

	.contact .btn {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	#work {
		scroll-margin-top: 0.5rem;
	}
</style>
