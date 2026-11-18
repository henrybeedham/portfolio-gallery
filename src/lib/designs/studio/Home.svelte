<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Lock from '@lucide/svelte/icons/lock';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Camera from '@lucide/svelte/icons/camera';
	import Images from '@lucide/svelte/icons/images';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Play from '@lucide/svelte/icons/play';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Star from '@lucide/svelte/icons/star';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import Img from '#lib/components/Img.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import { mediaUrl, paragraphs, plural, viewQuery } from '#lib/utils.js';
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

	// The bento shows a handful of photos; the lightbox still steps through all of them.
	const MOSAIC_SIZE = 9;
	const mosaic = $derived(featuredPhotos.slice(0, MOSAIC_SIZE));
	const moreCount = $derived(featured ? featured.total - mosaic.length : 0);
	// The side tile previews the featured collection with a photo the hero isn't already showing.
	const sideCover = $derived(featuredPhotos[1] ?? featuredPhotos[0] ?? featured?.cover ?? null);

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

<main class="container">
	<!-- Opening bento: hero card, intro and a peek at the featured collection. -->
	<section class="bento hero-bento" class:no-side={!sideCover && !hasContact}>
		<div class="tile hero" class:has-image={!!settings.heroImage}>
			{#if settings.heroImage}
				<div class="hero-image" aria-hidden="true">
					<img
						src="/site/hero/large?v={settings.heroImage}"
						srcset="/site/hero/small?v={settings.heroImage} 1200w, /site/hero/large?v={settings.heroImage} 2400w"
						sizes="(min-width: 1000px) 66vw, 100vw"
						alt=""
						fetchpriority="high"
					/>
				</div>
			{/if}
			<div class="hero-content">
				<h1>
					{#each heroLines as line, i (i)}
						<span class="line" style:animation-delay="{0.08 + i * 0.08}s">{line}</span>
					{/each}
				</h1>
			</div>
		</div>

		<div class="tile intro fade-up" style:animation-delay="0.15s">
			<span class="kicker"><Sparkles size={14} strokeWidth={2} /> {settings.siteTitle}</span>
			{#if settings.heroDescription}
				<p class="hero-description">{settings.heroDescription}</p>
			{/if}
			<div class="intro-actions">
				<a class="btn btn-solid" href={featured ? '#work' : '/galleries'}>
					View Work <ArrowRight size={16} />
				</a>
				<a class="btn" href="/galleries">All Galleries</a>
			</div>
		</div>

		{#if sideCover && featured}
			<a class="tile peek fade-up" style:animation-delay="0.25s" href="#work">
				<Img src={mediaUrl(sideCover, 'medium')} alt="" eager />
				<span class="peek-label">
					<span class="peek-kicker">Featured</span>
					<strong>{featured.title}</strong>
				</span>
				<span class="peek-go" aria-hidden="true"><ArrowDown size={16} strokeWidth={2} /></span>
			</a>
		{:else if hasContact}
			{@render contactCard('side')}
		{/if}
	</section>

	{#if featured}
		<section id="work" class="section">
			<div class="section-head">
				<div class="head-text">
					<span class="kicker"><Star size={14} strokeWidth={2} /> Featured collection</span>
					<h2>{featured.title}</h2>
					{#if featured.descriptionHtml}
						<div class="prose">{@html featured.descriptionHtml}</div>
					{/if}
				</div>
				<a class="btn btn-quiet" href="/{featured.slug}">
					View Full Collection
					{#if featured.total}<span class="count">{featured.total}</span>{/if}
					<ArrowRight size={16} />
				</a>
			</div>

			{#if featured.locked}
				<a class="locked-feature" href="/{featured.slug}">
					{#if featured.cover}
						<Img src={mediaUrl(featured.cover, 'medium')} alt="" />
					{/if}
					<span class="locked-label">
						<span class="lock-icon"><Lock size={18} strokeWidth={2} /></span>
						Password protected — enter to view
					</span>
				</a>
			{:else if mosaic.length}
				<div class="mosaic">
					{#each mosaic as photo, i (photo.id)}
						<a
							class="m-tile"
							href={photoHref(photo)}
							onclick={(event) => {
								if (event.metaKey || event.ctrlKey || event.button !== 0) return;
								event.preventDefault();
								openLightbox(i);
							}}
							aria-label={photo.name}
							data-sveltekit-reset="false"
							data-sveltekit-preload-data="false"
						>
							<Img
								src={mediaUrl(photo, i === 0 ? 'medium' : 'thumb')}
								alt={photo.name}
								width={photo.w || undefined}
								height={photo.h || undefined}
								eager={i < 3}
							/>
							{#if photo.kind === 'video'}
								<span class="video-badge" aria-hidden="true"
									><Play size={11} strokeWidth={2.5} /></span
								>
							{/if}
						</a>
					{/each}
					{#if moreCount > 0}
						<a class="m-tile more" href="/{featured.slug}">
							<strong>+{moreCount}</strong>
							<span>more photos</span>
						</a>
					{/if}
				</div>
			{:else}
				<p class="empty">Photos from this collection will appear here soon.</p>
			{/if}
		</section>
	{/if}

	{#if data.albums.length}
		<section class="section" id={featured ? undefined : 'work'}>
			<div class="section-head">
				<div class="head-text">
					<span class="kicker"><Images size={14} strokeWidth={2} /> Explore more</span>
					<h2>Recent galleries</h2>
				</div>
				<a class="btn btn-quiet" href="/galleries">View All Galleries <ArrowRight size={16} /></a>
			</div>
			<div class="galleries">
				{#each data.albums.slice(0, 4) as album, i (album.id)}
					<a class="g-tile" class:big={i === 0} href="/{album.slug}">
						{#if album.cover}
							<Img
								src={mediaUrl(album.cover, 'medium')}
								alt=""
								width={album.cover.w || undefined}
								height={album.cover.h || undefined}
							/>
						{/if}
						<span class="g-label">
							<strong>{album.title}</strong>
							<span>
								{#if album.locked}<Lock size={12} strokeWidth={2} /> Private{:else if album.count !== null}{plural(
										album.count,
										'photo'
									)}{/if}
							</span>
						</span>
					</a>
				{/each}
				<a class="g-tile all" href="/galleries">
					<span class="all-icon"><ArrowUpRight size={22} strokeWidth={2} /></span>
					<strong>All galleries</strong>
					<span>Browse every collection</span>
				</a>
			</div>
		</section>
	{/if}

	<section id="about" class="bento about-bento" class:solo={!hasContact || !sideCover}>
		<div class="tile about">
			<span class="kicker"><Camera size={14} strokeWidth={2} /> Behind the camera</span>
			<h2>{settings.aboutTitle}</h2>
			<div class="about-body">
				{#each paragraphs(settings.aboutText) as paragraph, i (i)}
					<p>{paragraph}</p>
				{/each}
			</div>
		</div>
		{#if hasContact && sideCover}
			{@render contactCard('about')}
		{/if}
	</section>
</main>

{#snippet contactCard(where: 'side' | 'about')}
	<div class="tile contact" class:side={where === 'side'}>
		<span class="contact-icon"><MessageCircle size={20} strokeWidth={2} /></span>
		<h3>Let’s work together</h3>
		<p>Get in touch to talk about a shoot or a booking.</p>
		<ul>
			{#if settings.contactEmail}
				<li>
					<a href="mailto:{settings.contactEmail}"
						><Mail size={16} strokeWidth={2} /> <span>{settings.contactEmail}</span></a
					>
				</li>
			{/if}
			{#if settings.contactPhone}
				<li>
					<a href="tel:{settings.contactPhone.replace(/[^\d+]/g, '')}"
						><Phone size={16} strokeWidth={2} /> <span>{settings.contactPhone}</span></a
					>
				</li>
			{/if}
		</ul>
	</div>
{/snippet}

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
	main {
		display: grid;
		gap: clamp(3rem, 7vw, 5.5rem);
		padding-top: 12px;
	}

	.bento {
		display: grid;
		gap: clamp(0.6rem, 1.2vw, 0.9rem);
	}

	.tile {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--edge);
		border-radius: var(--radius-xl);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-sm);
	}

	/* ------------------------------------------------------------ hero bento */

	.hero-bento {
		grid-template-columns: minmax(0, 1fr);
	}

	@media (min-width: 900px) {
		.hero-bento {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr);
		}

		.hero {
			grid-row: span 2;
		}

		.hero-bento.no-side .intro {
			grid-row: span 2;
		}
	}

	.hero {
		display: flex;
		align-items: flex-end;
		min-height: clamp(420px, 72svh, 720px);
		background: var(--surface);
	}

	.hero:not(.has-image) {
		min-height: clamp(320px, 52svh, 520px);
		background:
			radial-gradient(
				circle at 85% 15%,
				color-mix(in srgb, var(--ink) 14%, transparent),
				transparent 55%
			),
			var(--surface);
	}

	.hero-image {
		position: absolute;
		inset: 0;
	}

	.hero-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: hero-in 1s var(--ease) both;
	}

	@keyframes hero-in {
		from {
			opacity: 0;
			transform: scale(1.03);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.has-image .hero-image::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--bg) 88%, transparent) 0%,
			color-mix(in srgb, var(--bg) 55%, transparent) 30%,
			transparent 62%
		);
	}

	.hero-content {
		position: relative;
		padding: clamp(1.4rem, 4vw, 3rem);
	}

	h1 {
		font-size: clamp(2.4rem, 6vw, 5.2rem);
		font-weight: 800;
		line-height: 0.98;
		letter-spacing: -0.045em;
		max-width: 13ch;
	}

	.line {
		display: block;
		animation: fade-up 0.7s var(--ease) both;
	}

	.line:nth-child(even) {
		color: var(--highlight, var(--text-muted));
	}

	.intro {
		display: grid;
		align-content: space-between;
		justify-items: start;
		gap: 1.5rem;
		padding: clamp(1.4rem, 3vw, 2rem);
	}

	.hero-description {
		font-size: clamp(1.05rem, 1.5vw, 1.25rem);
		font-weight: 500;
		line-height: 1.5;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	.intro-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.peek {
		display: block;
		min-height: 240px;
		text-decoration: none;
		background: var(--placeholder);
		transition:
			transform var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}

	.peek :global(img) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.peek:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow);
	}

	.peek:hover :global(img.loaded) {
		transform: scale(1.04);
	}

	.peek-label {
		position: absolute;
		left: 12px;
		bottom: 12px;
		right: 64px;
		display: grid;
		gap: 0.05rem;
		padding: 0.6rem 0.9rem;
		border-radius: var(--radius);
		background: var(--header-bg);
		backdrop-filter: blur(14px) saturate(1.4);
		-webkit-backdrop-filter: blur(14px) saturate(1.4);
	}

	.peek-kicker {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--highlight, var(--text-muted));
	}

	.peek-label strong {
		font-size: 0.98rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.peek-go {
		position: absolute;
		right: 12px;
		bottom: 12px;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--ink);
		color: var(--bg);
	}

	/* ------------------------------------------------------------- sections */

	.section {
		display: grid;
		gap: clamp(1.25rem, 3vw, 2rem);
		scroll-margin-top: 90px;
	}

	.section-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.25rem 2rem;
	}

	.head-text {
		display: grid;
		justify-items: start;
		gap: 0.85rem;
		max-width: 46rem;
	}

	h2 {
		font-size: clamp(1.9rem, 4vw, 3rem);
		font-weight: 800;
		letter-spacing: -0.035em;
	}

	.count {
		display: inline-grid;
		place-items: center;
		min-width: 24px;
		height: 22px;
		padding: 0 0.4rem;
		border-radius: var(--radius-pill);
		background: var(--surface-strong);
		font-size: 0.74rem;
		font-variant-numeric: tabular-nums;
	}

	.empty {
		padding: 4rem 1rem;
		text-align: center;
		color: var(--text-subtle);
		border-radius: var(--radius-xl);
		background: var(--bg-elevated);
		border: 1px solid var(--edge);
	}

	/* Featured photos as a mixed-size mosaic */
	.mosaic {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-auto-rows: clamp(150px, 42vw, 220px);
		grid-auto-flow: dense;
		gap: clamp(0.5rem, 1vw, 0.75rem);
	}

	@media (min-width: 760px) {
		.mosaic {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			grid-auto-rows: clamp(160px, 17vw, 240px);
		}

		.m-tile:nth-child(6) {
			grid-column: span 2;
		}

		.m-tile:nth-child(4) {
			grid-row: span 2;
		}
	}

	.m-tile:first-child {
		grid-column: span 2;
		grid-row: span 2;
	}

	.m-tile {
		position: relative;
		display: block;
		overflow: hidden;
		border-radius: var(--radius-lg);
		background: var(--placeholder);
		cursor: zoom-in;
		transition:
			transform var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}

	.m-tile :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.m-tile:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow);
	}

	.m-tile:hover :global(img.loaded) {
		transform: scale(1.03);
	}

	.video-badge {
		position: absolute;
		left: 10px;
		bottom: 10px;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
	}

	.m-tile.more {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.1rem;
		background: var(--ink);
		color: var(--bg);
		text-decoration: none;
		cursor: pointer;
	}

	.more strong {
		font-size: clamp(1.8rem, 3vw, 2.4rem);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1;
	}

	.more span {
		font-size: 0.85rem;
		font-weight: 600;
		opacity: 0.75;
	}

	.locked-feature {
		position: relative;
		display: block;
		aspect-ratio: 16 / 7;
		min-height: 240px;
		overflow: hidden;
		border-radius: var(--radius-xl);
		background: var(--placeholder);
		text-decoration: none;
	}

	.locked-feature :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(10px) brightness(0.9);
		transform: scale(1.08);
	}

	.locked-label {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		font-weight: 600;
		background: color-mix(in srgb, var(--bg) 40%, transparent);
	}

	.lock-icon {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--bg-elevated);
		box-shadow: var(--shadow);
	}

	/* Recent galleries as mixed-size tiles */
	.galleries {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-auto-rows: clamp(170px, 46vw, 240px);
		gap: clamp(0.5rem, 1vw, 0.75rem);
	}

	@media (min-width: 900px) {
		.galleries {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			grid-auto-rows: clamp(180px, 18vw, 250px);
		}
	}

	.g-tile {
		position: relative;
		display: block;
		overflow: hidden;
		border-radius: var(--radius-lg);
		background: var(--placeholder);
		text-decoration: none;
		transition:
			transform var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}

	.g-tile.big {
		grid-column: span 2;
		grid-row: span 2;
	}

	.g-tile :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.g-tile:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow);
	}

	.g-tile:hover :global(img.loaded) {
		transform: scale(1.04);
	}

	.g-label {
		position: absolute;
		left: 10px;
		right: 10px;
		bottom: 10px;
		display: grid;
		padding: 0.55rem 0.85rem;
		border-radius: var(--radius);
		background: var(--header-bg);
		backdrop-filter: blur(14px) saturate(1.4);
		-webkit-backdrop-filter: blur(14px) saturate(1.4);
	}

	.g-label strong {
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.big .g-label strong {
		font-size: clamp(1.05rem, 1.8vw, 1.35rem);
	}

	.g-label span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.g-tile.all {
		display: grid;
		align-content: end;
		gap: 0.15rem;
		padding: 1.25rem;
		border: 1px solid var(--edge);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-sm);
	}

	.all-icon {
		position: absolute;
		top: 1rem;
		right: 1rem;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--surface);
		transition:
			background-color var(--dur) var(--ease),
			color var(--dur) var(--ease),
			transform var(--dur) var(--ease);
	}

	.g-tile.all:hover .all-icon {
		background: var(--ink);
		color: var(--bg);
		transform: rotate(45deg);
	}

	.g-tile.all strong {
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: -0.015em;
	}

	.g-tile.all > span:last-child {
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	/* --------------------------------------------------------- about + contact */

	.about-bento {
		scroll-margin-top: 90px;
	}

	@media (min-width: 900px) {
		.about-bento:not(.solo) {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		}
	}

	.about {
		display: grid;
		justify-items: start;
		gap: 1.1rem;
		padding: clamp(1.5rem, 4vw, 3rem);
	}

	.about h2 {
		max-width: 18ch;
	}

	.about-body {
		display: grid;
		gap: 1rem;
		max-width: 64ch;
		font-size: 1.02rem;
		line-height: 1.75;
		color: var(--text-muted);
	}

	.about-body p:first-child {
		font-size: clamp(1.15rem, 1.8vw, 1.35rem);
		font-weight: 500;
		line-height: 1.5;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	.contact {
		display: grid;
		align-content: start;
		justify-items: start;
		gap: 0.75rem;
		padding: clamp(1.5rem, 3vw, 2rem);
		border-color: transparent;
		background: var(--ink);
		color: var(--bg);
	}

	.contact-icon {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		margin-bottom: 0.5rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--bg) 16%, transparent);
	}

	.contact h3 {
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: -0.03em;
	}

	.contact p {
		opacity: 0.75;
		font-size: 0.95rem;
	}

	.contact ul {
		display: grid;
		gap: 0.5rem;
		width: 100%;
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}

	.contact a {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-height: 48px;
		padding: 0.5rem 1rem;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--bg) 14%, transparent);
		font-weight: 600;
		font-size: 0.92rem;
		text-decoration: none;
		transition:
			background-color var(--dur) var(--ease),
			transform var(--dur) var(--ease);
	}

	.contact a span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.contact a:hover {
		background: color-mix(in srgb, var(--bg) 24%, transparent);
		transform: translateY(-1px);
	}

	#work {
		scroll-margin-top: 90px;
	}
</style>
