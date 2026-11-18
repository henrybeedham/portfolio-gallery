<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
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
	import PhotoGallery from '#lib/components/PhotoGallery.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { nativeDownload } from '#lib/download.js';
	import { expiryLabel, formatDay, plural, viewQuery } from '#lib/utils.js';
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
</script>

<header class="topbar">
	<div class="container inner">
		<a class="link back" href="/"
			><ArrowLeft size={14} strokeWidth={1.5} />
			<span class="home-label">{settings.siteTitle}</span></a
		>
		<span class="top-title">{album.title}</span>
		<span class="top-count sc">{plural(data.albumCount, 'plate')}</span>
	</div>
</header>

{#if data.isAdmin}
	<div class="admin-bar container">
		{#if data.preview}
			<span><Eye size={14} strokeWidth={1.5} /> <em>Previewing as a visitor</em></span>
			<a class="link" href="/{album.slug}">Exit Preview</a>
		{:else}
			<span>
				<em>You’re viewing as the administrator</em>
				{#if data.expired}<span class="flag sc">Expired</span>{/if}
				{#if !album.isPublic}<span class="flag sc">Private</span>{/if}
			</span>
			<span class="admin-links">
				<a class="link" href="/{album.slug}?preview=1"
					><Eye size={14} strokeWidth={1.5} /> Preview</a
				>
				<a class="link" href="/admin/albums/{album.id}"
					><Pencil size={14} strokeWidth={1.5} /> Edit Album</a
				>
			</span>
		{/if}
	</div>
{/if}

<main>
	<section class="title-page container">
		<p class="presents sc fade-in">{settings.siteTitle}</p>
		<h1 class="fade-in" style:animation-delay="0.15s">{album.title}</h1>
		<div class="ornament fade-in" style:animation-delay="0.3s" aria-hidden="true"></div>
		<p class="meta sc fade-in" style:animation-delay="0.35s">
			{#if album.albumDate}<span>{formatDay(album.albumDate)}</span>{/if}
			<span>{plural(data.albumCount, 'photograph')}</span>
		</p>
		{#if expiry && !(adminView && data.expired)}
			<p class="expiry fade-in" style:animation-delay="0.4s">
				<Clock size={13} strokeWidth={1.5} /> <em>{expiry}</em>
			</p>
		{/if}
		{#if data.descriptionHtml}
			<div class="prose description fade-in" style:animation-delay="0.45s">
				{@html data.descriptionHtml}
			</div>
		{/if}
		{#if data.albumCount}
			<div class="actions fade-in" style:animation-delay="0.6s">
				<button class="btn btn-accent" onclick={() => startDownload('all')} disabled={!!started}>
					{#if started === 'all'}<Check size={14} strokeWidth={1.5} />{:else}<Download
							size={14}
							strokeWidth={1.5}
						/>{/if}
					{started === 'all' ? 'Download Started' : 'Download All'}
				</button>
				<button
					class="btn btn-quiet"
					class:active={selecting}
					onclick={() => (selecting ? exitSelection() : (selecting = true))}
				>
					<SquareCheck size={14} strokeWidth={1.5} />
					{selecting ? 'Cancel Selection' : 'Select to Download'}
				</button>
			</div>
		{/if}
	</section>

	{#if data.albumCount}
		<div class="toolbar">
			<div class="container toolbar-inner">
				{#if data.tags.length}
					<div class="tags" role="group" aria-label="Filter by tag">
						<button
							class="tag sc"
							class:active={!data.view.tag}
							onclick={() => setView({ tag: null })}
						>
							All
						</button>
						{#each data.tags as tag (tag.id)}
							<button
								class="tag sc"
								class:active={data.view.tag === tag.id}
								onclick={() => setView({ tag: tag.id })}
							>
								{tag.name}
							</button>
						{/each}
					</div>
				{:else}
					<span></span>
				{/if}
				<label class="sort">
					<span class="sc">Order</span>
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
			</div>
		</div>
	{/if}

	<section class="photos container" aria-live="polite">
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
			<div class="empty">
				<ImageIcon size={26} strokeWidth={1} />
				{#if data.view.tag}
					<p>No photographs carry this tag yet.</p>
					<button class="btn btn-sm" onclick={() => setView({ tag: null })}>Show All Photos</button>
				{:else}
					<p>There are no photographs in this gallery yet.</p>
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
							<span class="spinner"></span> <em>Loading more photographs…</em>
						</p>
					{/if}
					<p class="subtle sc">
						Showing {photos.length.toLocaleString()} of {total.toLocaleString()}
					</p>
				{:else}
					<div class="ornament" aria-hidden="true"></div>
					<p class="done">
						<span class="sc">Finis</span>
						<em
							>{total === 1
								? 'That’s the only photograph'
								: `You’ve seen all ${total.toLocaleString()} photographs`}</em
						>
					</p>
				{/if}
			</div>
		{/if}
	</section>
</main>

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

{#if selecting}
	<div class="selection-bar" transition:fade={{ duration: 500 }}>
		<div class="selection-inner">
			<span class="selection-count">
				<strong>{selected.size.toLocaleString()}</strong> <em>selected</em>
			</span>
			<div class="selection-actions">
				<button class="link" onclick={selectAll} disabled={selectingAll}>
					{selectingAll ? 'Selecting…' : 'Select All'}
				</button>
				<button class="link" onclick={() => selected.clear()} disabled={!selected.size}
					>Clear</button
				>
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
	.topbar {
		position: sticky;
		top: 0;
		z-index: 40;
		background: var(--header-bg);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-bottom: 3px double color-mix(in srgb, var(--border-strong) 80%, transparent);
	}

	.topbar .inner {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		height: 56px;
	}

	.back {
		justify-self: start;
		min-height: 40px;
	}

	.top-title {
		font-family: var(--font-display);
		font-style: italic;
		font-size: 1.3rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 44vw;
	}

	.top-count {
		justify-self: end;
		font-size: 0.98rem;
		color: var(--text-subtle);
	}

	.home-label {
		max-width: 22vw;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.home-label,
		.top-count {
			display: none;
		}

		.topbar .inner {
			grid-template-columns: 40px minmax(0, 1fr) 40px;
		}

		.top-title {
			max-width: none;
			justify-self: center;
		}
	}

	.admin-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem 2rem;
		padding-block: 0.6rem;
		font-size: 0.98rem;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border);
		text-align: center;
	}

	.admin-bar span {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.admin-links {
		gap: 1.5rem !important;
	}

	.flag {
		font-size: 0.92rem;
		padding: 0 0.45rem 0.1rem;
		border: 1px solid color-mix(in srgb, var(--warning) 60%, transparent);
		color: var(--warning);
	}

	/* ------------------------------------------------------------ title page */

	.title-page {
		display: grid;
		justify-items: center;
		gap: 1.1rem;
		padding-block: clamp(3.5rem, 9vw, 7rem) clamp(2.5rem, 6vw, 4.5rem);
		text-align: center;
	}

	.presents {
		font-size: 1rem;
		letter-spacing: 0.2em;
		margin-right: -0.2em;
		color: var(--highlight, var(--text-subtle));
	}

	h1 {
		font-size: clamp(2.7rem, 7.4vw, 5.8rem);
		font-weight: 400;
		line-height: 1.02;
		max-width: 16ch;
	}

	.title-page .ornament {
		margin-block: 0.4rem 0.1rem;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.25rem 0.9rem;
		font-size: 1.05rem;
		color: var(--text-muted);
	}

	.meta span + span::before {
		content: '·';
		margin-right: 0.9rem;
		color: var(--text-subtle);
	}

	.expiry {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--warning);
	}

	.description {
		max-width: var(--measure);
		margin-top: 0.5rem;
		font-style: italic;
		font-size: clamp(1.08rem, 1.5vw, 1.22rem);
		text-align: center;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 1.25rem;
	}

	.btn.active {
		--btn-bg: var(--surface);
		--btn-border: var(--text);
	}

	/* --------------------------------------------------------------- toolbar */

	.toolbar {
		position: sticky;
		top: 59px;
		z-index: 30;
		margin-bottom: clamp(2rem, 4vw, 3rem);
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--border);
	}

	.toolbar-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 0.35rem;
	}

	.tags {
		display: flex;
		align-items: center;
		gap: 0.1rem;
		overflow-x: auto;
		scrollbar-width: none;
		min-width: 0;
		mask-image: linear-gradient(to right, #000 90%, transparent);
		padding-right: 1.5rem;
	}

	.tag {
		flex: none;
		min-height: 40px;
		padding: 0.3rem 0.7rem 0.4rem;
		border: 0;
		background: none;
		font-size: 1.02rem;
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: transparent;
		text-decoration-thickness: 1px;
		text-underline-offset: 6px;
		transition:
			color 0.5s var(--ease),
			text-decoration-color 0.5s var(--ease);
	}

	.tag + .tag::before {
		content: '·';
		display: inline-block;
		margin-right: 0.8rem;
		color: var(--text-subtle);
		text-decoration: none;
	}

	.tag:hover {
		color: var(--text);
	}

	.tag.active {
		color: var(--text);
		text-decoration-color: var(--highlight, currentColor);
	}

	.sort {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex: none;
	}

	.sort .sc {
		font-size: 1rem;
		color: var(--text-subtle);
	}

	.sort .select {
		min-height: 38px;
		width: auto;
		padding-block: 0.25rem;
		font-size: 1rem;
		font-style: italic;
		border-bottom-color: transparent;
	}

	.sort .select:hover,
	.sort .select:focus {
		border-bottom-color: var(--text-muted);
	}

	@media (max-width: 560px) {
		.sort .sc {
			display: none;
		}
	}

	/* ---------------------------------------------------------------- plates */

	.empty {
		display: grid;
		justify-items: center;
		gap: 1rem;
		padding: 5rem 1rem;
		border-block: 3px double var(--border-strong);
		color: var(--text-muted);
		font-style: italic;
		text-align: center;
	}

	.load-more {
		display: grid;
		justify-items: center;
		gap: 0.85rem;
		padding-top: clamp(3.5rem, 8vw, 5.5rem);
		text-align: center;
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.done {
		display: grid;
		gap: 0.15rem;
		color: var(--text-muted);
	}

	.done .sc {
		font-size: 1.1rem;
		letter-spacing: 0.2em;
		color: var(--text);
	}

	/* ------------------------------------------------------------- selection */

	.selection-bar {
		position: fixed;
		left: 50%;
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: 60;
		translate: -50% 0;
		width: min(calc(100% - 2rem), 720px);
		background: var(--bg-elevated);
		border: 3px double var(--border-strong);
		box-shadow: 0 18px 50px color-mix(in srgb, var(--text) 12%, transparent);
	}

	.selection-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem 0.6rem 0.6rem 1.25rem;
	}

	.selection-count {
		font-size: 1.02rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.selection-count strong {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 500;
		color: var(--text);
		font-variant-numeric: lining-nums;
	}

	.selection-actions {
		display: flex;
		align-items: center;
		gap: 1.1rem;
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
		background: none;
		cursor: pointer;
		color: var(--text-muted);
	}

	@media (max-width: 560px) {
		.selection-inner {
			flex-wrap: wrap;
			padding: 0.65rem 0.9rem;
		}

		.selection-actions {
			width: 100%;
			justify-content: space-between;
			gap: 0.75rem;
		}
	}
</style>
