<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Download from '@lucide/svelte/icons/download';
	import SquareCheck from '@lucide/svelte/icons/square-check';
	import Check from '@lucide/svelte/icons/check';
	import Clock from '@lucide/svelte/icons/clock';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Eye from '@lucide/svelte/icons/eye';
	import ImageIcon from '@lucide/svelte/icons/image';
	import X from '@lucide/svelte/icons/x';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Img from '#lib/components/Img.svelte';
	import PhotoGallery from '#lib/components/PhotoGallery.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { nativeDownload } from '#lib/download.js';
	import { expiryLabel, formatDay, mediaUrl, plural, viewQuery } from '#lib/utils.js';
	import type { AlbumViewData, PhotoItem, SortOrder, ViewQuery } from '#lib/types.js';

	let { data }: { data: AlbumViewData } = $props();

	const album = $derived(data.album);
	const settings = $derived(data.settings);
	const adminView = $derived(data.isAdmin && !data.preview);

	// Writable derived values: reset whenever the server data changes (new filter/sort), and
	// extended locally by "Load More".
	let photos = $derived(data.photos);
	let total = $derived(data.total);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);
	const hasMore = $derived(photos.length < total);

	// Infinite scroll: load the next page when a sentinel below the grid nears the viewport.
	// The observer is recreated after each load so a still-visible sentinel triggers again.
	let sentinel = $state<HTMLElement>();
	$effect(() => {
		if (!sentinel || !hasMore || loadingMore || loadError) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) loadMore();
			},
			{ rootMargin: '0px 0px 1200px 0px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	let selecting = $state(false);
	const selected = new SvelteSet<number>();
	let selectingAll = $state(false);

	let started = $state<'all' | 'selection' | null>(null);

	let now = $state(Date.now());
	onMount(() => {
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});
	const expiry = $derived(expiryLabel(album.expiresAt, now));

	// Counted once the page is actually shown, so hovering a link that preloads it doesn't count.
	const slug = $derived(album.slug);
	$effect(() => {
		if (!data.isAdmin) fetch(`/${slug}/view`, { method: 'POST', keepalive: true }).catch(() => {});
	});

	const SORT_LABELS: Record<SortOrder, string> = {
		oldest: 'Oldest first',
		newest: 'Newest first',
		random: 'Random'
	};

	function extraParams(extra: Record<string, string> = {}) {
		return data.preview ? { preview: '1', ...extra } : extra;
	}

	function query(view: ViewQuery, extra: Record<string, string> = {}) {
		return viewQuery(view, { sort: album.sortOrder }, extraParams(extra));
	}

	function photoHref(photo: PhotoItem) {
		return `/${album.slug}/photo/${photo.id}${query(data.view)}`;
	}

	function setView(change: Partial<ViewQuery>) {
		const next: ViewQuery = { ...data.view, ...change };
		if (change.sort) {
			next.seed = change.sort === 'random' ? Math.floor(Math.random() * 2e9) + 1 : null;
		}
		goto(`/${album.slug}${query(next)}`, { replace: true, reset: false });
	}

	async function loadMore() {
		if (loadingMore || !hasMore) return;
		loadingMore = true;
		loadError = null;
		try {
			const response = await fetch(
				`/${album.slug}/photos${query(data.view, { offset: String(photos.length) })}`
			);
			if (!response.ok) throw new Error();
			const result: { photos: PhotoItem[]; total: number } = await response.json();
			const known = new Set(photos.map((p) => p.id));
			photos = [...photos, ...result.photos.filter((p) => !known.has(p.id))];
			total = result.total;
		} catch {
			loadError = 'Could not load more photos. Please try again.';
		} finally {
			loadingMore = false;
		}
	}

	/* --------------------------------------------------------------- lightbox */

	const lightboxIndex = $derived(
		page.state.lightbox != null ? photos.findIndex((p) => p.id === page.state.lightbox) : -1
	);

	function openLightbox(index: number) {
		const photo = photos[index];
		goto(photoHref(photo), { shallow: true, state: { lightbox: photo.id } });
	}

	function navigateLightbox(index: number) {
		const photo = photos[index];
		if (!photo) return;
		goto(photoHref(photo), { shallow: true, replace: true, state: { lightbox: photo.id } });
		if (index >= photos.length - 4 && hasMore) loadMore();
	}

	function closeLightbox() {
		history.back();
	}

	/* -------------------------------------------------------------- selection */

	function toggle(photo: PhotoItem) {
		if (selected.has(photo.id)) selected.delete(photo.id);
		else selected.add(photo.id);
	}

	async function selectAll() {
		selectingAll = true;
		try {
			const response = await fetch(`/${album.slug}/photos${query(data.view, { ids: '1' })}`);
			if (!response.ok) throw new Error();
			const result: { ids: number[] } = await response.json();
			for (const id of result.ids) selected.add(id);
		} catch {
			for (const photo of photos) selected.add(photo.id);
		} finally {
			selectingAll = false;
		}
	}

	function exitSelection() {
		selecting = false;
		selected.clear();
	}

	/* -------------------------------------------------------------- downloads */

	/** The browser's download manager takes over, so the button only needs to acknowledge the click. */
	function startDownload(target: 'all' | 'selection', query = '', body?: Record<string, string>) {
		if (started) return;
		nativeDownload(`/${album.slug}/download${query}`, body);
		started = target;
		setTimeout(() => (started = null), 3000);
	}

	function downloadSelected() {
		if (!selected.size) return;
		const ids = [...selected].join(',');
		// A selection that fits in a link can be resumed by the browser if the connection drops.
		if (ids.length <= 4000) startDownload('selection', `?ids=${ids}`);
		else startDownload('selection', '', { ids });
	}

	/* ------------------------------------------------------------ cover band */

	// The album's background photo, or its first photo. Fixed for the life of the page so filtering
	// or re-sorting doesn't swap the picture.
	const bandImage = untrack(() => data.background ?? data.photos[0] ?? null);

	let scrollY = $state(0);
	let bandHeight = $state(0);
	const pastBand = $derived(scrollY > Math.max(120, bandHeight - 80));

	function skipToPhotos() {
		document.getElementById('photos')?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<svelte:window bind:scrollY />

<header class="topbar" class:solid={pastBand}>
	<div class="bar">
		<a class="back" href="/" aria-label="Back to {settings.siteTitle}">
			<ArrowLeft size={16} />
			<span class="home-label">{settings.siteTitle}</span>
		</a>
		<span class="top-title" aria-hidden={!pastBand}>{album.title}</span>
		<span class="top-count">{plural(data.albumCount, 'photo')}</span>
	</div>
</header>

<main>
	<section class="band" class:has-image={!!bandImage} bind:clientHeight={bandHeight}>
		{#if bandImage}
			<div class="band-image" aria-hidden="true">
				<Img
					src={mediaUrl(bandImage, 'medium')}
					alt=""
					width={bandImage.w || undefined}
					height={bandImage.h || undefined}
					eager
				/>
			</div>
		{/if}

		{#if data.isAdmin}
			<div class="admin-bar">
				{#if data.preview}
					<span><Eye size={14} /> Previewing as a visitor</span>
					<a class="link" href="/{album.slug}">Exit Preview</a>
				{:else}
					<span>
						You’re viewing as the administrator
						{#if data.expired}<em class="flag">Expired</em>{/if}
						{#if !album.isPublic}<em class="flag">Private</em>{/if}
					</span>
					<span class="admin-links">
						<a class="link" href="/{album.slug}?preview=1"><Eye size={14} /> Preview</a>
						<a class="link" href="/admin/albums/{album.id}"><Pencil size={14} /> Edit Album</a>
					</span>
				{/if}
			</div>
		{/if}

		<div class="band-content container">
			<div class="meta eyebrow fade-up">
				{#if album.albumDate}<span>{formatDay(album.albumDate)}</span>{/if}
				<span>{plural(data.albumCount, 'photo')}</span>
				{#if expiry && !(adminView && data.expired)}
					<span class="expiry"><Clock size={13} /> {expiry}</span>
				{/if}
			</div>
			<h1 class="fade-up" style:animation-delay="0.12s">{album.title}</h1>
			{#if data.albumCount}
				<button class="skip fade-up" style:animation-delay="0.3s" onclick={skipToPhotos}>
					<ArrowDown size={15} /> View Photos
				</button>
			{/if}
		</div>
	</section>

	{#if data.descriptionHtml}
		<section class="about container">
			<div class="prose">{@html data.descriptionHtml}</div>
		</section>
	{/if}

	<section id="photos" class="photos" aria-live="polite">
		{#if photos.length}
			<PhotoGallery
				{photos}
				layout={album.layout}
				href={photoHref}
				onopen={openLightbox}
				{selecting}
				{selected}
				ontoggle={toggle}
			/>
		{:else}
			<div class="empty container">
				<ImageIcon size={28} strokeWidth={1} />
				{#if data.view.tag}
					<p>No photos have this tag yet.</p>
					<button class="btn btn-sm" onclick={() => setView({ tag: null })}>Show All Photos</button>
				{:else}
					<p>There are no photos in this gallery yet.</p>
				{/if}
			</div>
		{/if}

		{#if photos.length}
			<div class="load-more" bind:this={sentinel}>
				{#if hasMore}
					{#if loadError}
						<p class="error-text">{loadError}</p>
						<button class="btn" onclick={loadMore} disabled={loadingMore}>Try Again</button>
					{:else}
						<p class="subtle loading" aria-live="polite">
							<span class="spinner"></span> Loading more photos…
						</p>
					{/if}
					<p class="subtle">Showing {photos.length.toLocaleString()} of {total.toLocaleString()}</p>
				{:else}
					<p class="done eyebrow">
						{total === 1
							? 'That’s the only photo'
							: `You’ve seen all ${total.toLocaleString()} photos`}
					</p>
				{/if}
			</div>
		{/if}
	</section>

	{#if data.albumCount && !selecting}
		<div class="dock-wrap" transition:fly={{ y: 40, duration: 400 }}>
			<div class="dock" role="toolbar" aria-label="Gallery tools">
				{#if data.tags.length}
					<div class="tags" role="group" aria-label="Filter by tag">
						<button
							class="chip"
							class:active={!data.view.tag}
							onclick={() => setView({ tag: null })}
						>
							All
						</button>
						{#each data.tags as tag (tag.id)}
							<button
								class="chip"
								class:active={data.view.tag === tag.id}
								onclick={() => setView({ tag: tag.id })}
							>
								{tag.name}
							</button>
						{/each}
					</div>
					<span class="divider" aria-hidden="true"></span>
				{/if}
				<div class="controls">
					<label class="sort">
						<span class="visually-hidden">Sort</span>
						<select
							class="select"
							value={data.view.sort}
							onchange={(event) => setView({ sort: event.currentTarget.value as SortOrder })}
						>
							{#each Object.entries(SORT_LABELS) as [value, label] (value)}
								<option {value}>{label}</option>
							{/each}
						</select>
					</label>
					<button
						class="btn btn-sm btn-quiet select-btn"
						onclick={() => (selecting = true)}
						aria-label="Select photos to download"
					>
						<SquareCheck size={14} /> <span class="select-label">Select</span>
					</button>
					<button
						class="btn btn-sm btn-accent"
						onclick={() => startDownload('all')}
						disabled={!!started}
					>
						{#if started === 'all'}<Check size={14} />{:else}<Download size={14} />{/if}
						{started === 'all' ? 'Started' : 'Download All'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</main>

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

{#if selecting}
	<div class="selection-bar" transition:fly={{ y: 80, duration: 400 }}>
		<span class="selection-count">
			<strong>{selected.size.toLocaleString()}</strong> selected
		</span>
		<div class="selection-actions">
			<button class="link" onclick={selectAll} disabled={selectingAll}>
				{selectingAll ? 'Selecting…' : 'Select All'}
			</button>
			<button class="link" onclick={() => selected.clear()} disabled={!selected.size}>Clear</button>
			<button
				class="btn btn-sm btn-accent"
				onclick={downloadSelected}
				disabled={!selected.size || !!started}
			>
				{#if started === 'selection'}<Check size={13} />{:else}<Download size={13} />{/if}
				{started === 'selection' ? 'Download Started' : 'Download Selected'}
			</button>
			<button class="close" onclick={exitSelection} aria-label="Exit selection mode">
				<X size={18} strokeWidth={1.5} />
			</button>
		</div>
	</div>
{/if}

{#if lightboxIndex >= 0}
	<Lightbox
		{photos}
		index={lightboxIndex}
		{total}
		onclose={closeLightbox}
		onnavigate={navigateLightbox}
	/>
{/if}

<style>
	/* ---------------------------------------------------------------- top bar */

	.topbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		height: var(--header-height);
		padding-inline: clamp(0.5rem, 2vw, 1.5rem);
		pointer-events: none;
	}

	.bar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 1rem;
		width: 100%;
		max-width: var(--max-width);
		margin-inline: auto;
		height: 52px;
		padding: 0 1.1rem 0 0.4rem;
		border: 1px solid transparent;
		border-radius: var(--pill);
		pointer-events: auto;
		transition:
			background-color 0.6s var(--ease),
			border-color 0.6s var(--ease),
			box-shadow 0.6s var(--ease);
	}

	.solid .bar {
		background: var(--glass);
		border-color: var(--glass-border);
		box-shadow: var(--shadow-float);
		backdrop-filter: blur(18px) saturate(1.3);
		-webkit-backdrop-filter: blur(18px) saturate(1.3);
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		justify-self: start;
		min-width: 0;
		max-width: 100%;
		min-height: 44px;
		padding: 0 0.9rem;
		border-radius: var(--pill);
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
		transition: background-color 0.3s var(--ease);
	}

	.back:hover {
		background: color-mix(in srgb, var(--text) 8%, transparent);
	}

	.home-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.top-title {
		max-width: 40vw;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 500;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		opacity: 0;
		transform: translateY(6px);
		transition:
			opacity 0.6s var(--ease),
			transform 0.6s var(--ease);
	}

	.solid .top-title {
		opacity: 1;
		transform: none;
	}

	.top-count {
		justify-self: end;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.home-label,
		.top-count {
			display: none;
		}

		.bar {
			grid-template-columns: auto minmax(0, 1fr) 44px;
		}

		.top-title {
			max-width: none;
			justify-self: center;
		}
	}

	/* ---------------------------------------------------------------- cover band */

	.band {
		position: relative;
		display: grid;
		align-items: end;
		min-height: min(88svh, 900px);
		padding-top: calc(var(--header-height) + 4rem);
		padding-bottom: clamp(2.5rem, 6vw, 4.5rem);
		overflow: hidden;
		isolation: isolate;
	}

	.band:not(.has-image) {
		min-height: min(62svh, 620px);
	}

	.band-image {
		position: absolute;
		inset: 0;
		z-index: -1;
		background: var(--placeholder);
	}

	.band-image :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: opacity 1.6s var(--ease);
	}

	.band-image::after {
		content: '';
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to bottom, var(--scrim-soft) 0%, transparent 24%),
			linear-gradient(
				to top,
				var(--bg) 0%,
				color-mix(in srgb, var(--bg) 72%, transparent) 16%,
				color-mix(in srgb, var(--bg) 22%, transparent) 40%,
				transparent 58%
			);
	}

	.band-content {
		display: grid;
		justify-items: start;
		gap: 1rem;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 1.25rem;
		color: var(--text);
		font-size: 0.9rem;
	}

	.expiry {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.15rem 0.6rem;
		border-radius: var(--pill);
		background: var(--warning-soft);
		color: var(--warning);
	}

	h1 {
		font-size: clamp(3.2rem, 11vw, 10rem);
		line-height: 0.86;
		max-width: 16ch;
		overflow-wrap: anywhere;
	}

	.skip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
		padding: 0;
		border: 0;
		background: none;
		font-size: 0.86rem;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.3s var(--ease);
	}

	.skip:hover {
		color: var(--text);
	}

	.admin-bar {
		position: absolute;
		top: calc(var(--header-height) + 0.25rem);
		left: 50%;
		translate: -50% 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem 1.25rem;
		width: max-content;
		max-width: calc(100% - 2rem);
		padding: 0.5rem 1.1rem;
		border: 1px dashed var(--border-strong);
		border-radius: var(--pill);
		background: var(--glass);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.admin-bar span {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.admin-bar .link {
		font-size: 0.8rem;
	}

	.admin-links {
		gap: 1.1rem !important;
	}

	.flag {
		font-style: normal;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.1rem 0.5rem;
		border-radius: var(--pill);
		background: var(--warning-soft);
		color: var(--warning);
	}

	/* ---------------------------------------------------------------- description */

	.about {
		padding-block: clamp(0.5rem, 2vw, 1.5rem) clamp(2rem, 4vw, 3rem);
	}

	.about .prose {
		font-size: clamp(1rem, 1.3vw, 1.12rem);
	}

	/* ---------------------------------------------------------------- photos */

	.photos {
		scroll-margin-top: calc(var(--header-height) + 0.5rem);
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 1rem;
		padding-block: 5rem;
		color: var(--text-muted);
		text-align: center;
	}

	.load-more {
		display: grid;
		justify-items: center;
		gap: 0.85rem;
		padding: clamp(2.5rem, 6vw, 4rem) var(--gutter) 0;
		font-size: 0.85rem;
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.done {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.done::before,
	.done::after {
		content: '';
		width: 40px;
		height: 1px;
		background: var(--border-strong);
	}

	/* ---------------------------------------------------------------- dock */

	/* Rides along the bottom of the viewport, settling above the footer at the end of the page. */
	.dock-wrap {
		position: sticky;
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: 30;
		display: flex;
		justify-content: center;
		margin-top: 2.5rem;
		padding-inline: 0.75rem;
		pointer-events: none;
	}

	.dock {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: min(100%, 1100px);
		padding: 0.4rem;
		border: 1px solid var(--glass-border);
		border-radius: 28px;
		background: var(--glass);
		box-shadow: var(--shadow-float);
		backdrop-filter: blur(20px) saturate(1.3);
		-webkit-backdrop-filter: blur(20px) saturate(1.3);
		pointer-events: auto;
	}

	.tags {
		display: flex;
		gap: 0.25rem;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
		border-radius: var(--pill);
	}

	.tags::-webkit-scrollbar {
		display: none;
	}

	.chip {
		flex: none;
		min-height: 36px;
		padding: 0.4rem 0.95rem;
		border: 0;
		border-radius: var(--pill);
		background: transparent;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background-color 0.3s var(--ease),
			color 0.3s var(--ease);
	}

	.chip:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--text) 7%, transparent);
	}

	.chip.active {
		background: var(--accent);
		color: var(--accent-text);
	}

	.divider {
		flex: none;
		width: 1px;
		height: 24px;
		background: var(--border-strong);
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: none;
	}

	.sort .select {
		width: auto;
		min-height: 36px;
		padding-block: 0.3rem;
		padding-left: 0.9rem;
		border: 0;
		border-radius: var(--pill);
		background-color: color-mix(in srgb, var(--text) 5%, transparent);
		font-size: 0.82rem;
		font-weight: 600;
	}

	.sort .select:focus {
		box-shadow: 0 0 0 2px var(--emphasis);
	}

	@media (max-width: 720px) {
		.dock {
			flex-wrap: wrap;
			justify-content: center;
			border-radius: 22px;
			width: 100%;
		}

		.tags {
			flex: 1 1 100%;
		}

		.divider {
			display: none;
		}
	}

	@media (max-width: 720px) {
		.controls {
			flex: 1 1 100%;
			justify-content: center;
			min-width: 0;
		}
	}

	@media (max-width: 374px) {
		.sort .select {
			max-width: 8.5rem;
		}

		.select-label {
			display: none;
		}

		.select-btn {
			padding-inline: 0.7rem;
		}
	}

	/* ---------------------------------------------------------------- selection */

	.selection-bar {
		position: fixed;
		left: 50%;
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: 60;
		translate: -50% 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: min(calc(100% - 1.5rem), 720px);
		padding: 0.45rem 0.45rem 0.45rem 1.25rem;
		border: 1px solid var(--glass-border);
		border-radius: 28px;
		background: var(--glass);
		box-shadow: var(--shadow-float);
		backdrop-filter: blur(20px) saturate(1.3);
		-webkit-backdrop-filter: blur(20px) saturate(1.3);
	}

	.selection-count {
		font-size: 0.86rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.selection-count strong {
		font-family: var(--font-display);
		font-size: 1.3rem;
		font-weight: 500;
		color: var(--text);
	}

	.selection-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.selection-actions .link:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--text) 6%, transparent);
		cursor: pointer;
		color: var(--text-muted);
	}

	.close:hover {
		color: var(--text);
	}

	@media (max-width: 560px) {
		.selection-bar {
			flex-wrap: wrap;
			padding: 0.65rem 0.65rem 0.65rem 1rem;
			border-radius: 22px;
		}

		.selection-actions {
			width: 100%;
			justify-content: space-between;
			gap: 0.6rem;
		}
	}
</style>
