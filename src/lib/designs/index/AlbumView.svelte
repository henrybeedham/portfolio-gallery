<script lang="ts">
	import { onMount } from 'svelte';
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
	import PhotoGallery from '#lib/components/PhotoGallery.svelte';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { nativeDownload } from '#lib/download.js';
	import { expiryLabel, viewQuery } from '#lib/utils.js';
	import { formatNumericDay, indexNumber } from './format.js';
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
			><ArrowLeft size={14} /> <span class="home-label">{settings.siteTitle}</span></a
		>
		<span class="top-title">{album.title}</span>
		<span class="top-count">{indexNumber(data.albumCount, 3)} img</span>
	</div>
</header>

{#if data.isAdmin}
	<div class="admin-bar">
		<div class="container admin-inner">
			{#if data.preview}
				<span><Eye size={14} /> Previewing as a visitor</span>
				<a class="link" href="/{album.slug}">Exit Preview</a>
			{:else}
				<span>
					Viewing as the administrator
					{#if data.expired}<em class="flag">Expired</em>{/if}
					{#if !album.isPublic}<em class="flag">Private</em>{/if}
				</span>
				<span class="admin-links">
					<a class="link" href="/{album.slug}?preview=1"><Eye size={14} /> Preview</a>
					<a class="link" href="/admin/albums/{album.id}"><Pencil size={14} /> Edit Album</a>
				</span>
			{/if}
		</div>
	</div>
{/if}

<main class="container">
	<section class="intro grid-12">
		<p class="intro-meta">
			<span class="sec-no">No. {indexNumber(album.id, 3)}</span>
			<span class="mono-label">Gallery</span>
		</p>
		<h1>{album.title}</h1>
	</section>

	<div class="body grid-12">
		<aside class="meta-col" aria-label="About this gallery">
			<dl class="facts">
				{#if album.albumDate}
					<div>
						<dt>Date</dt>
						<dd>{formatNumericDay(album.albumDate)}</dd>
					</div>
				{/if}
				<div>
					<dt>Photos</dt>
					<dd>{data.albumCount.toLocaleString('en-GB')}</dd>
				</div>
				{#if expiry && !(adminView && data.expired)}
					<div class="expiry">
						<dt><Clock size={12} /> Expiry</dt>
						<dd>{expiry.replace(/^Expires in /, '')}</dd>
					</div>
				{/if}
			</dl>

			{#if data.albumCount}
				<div class="actions">
					<button class="btn btn-accent" onclick={() => startDownload('all')} disabled={!!started}>
						{#if started === 'all'}<Check size={14} />{:else}<Download size={14} />{/if}
						{started === 'all' ? 'Download Started' : 'Download All'}
					</button>
					<button
						class="btn btn-quiet"
						class:active={selecting}
						onclick={() => (selecting ? exitSelection() : (selecting = true))}
					>
						<SquareCheck size={14} />
						{selecting ? 'Cancel Selection' : 'Select to Download'}
					</button>
				</div>

				<div class="filters">
					{#if data.tags.length}
						<div class="filter-group">
							<p class="filter-label" id="tag-label">Filter</p>
							<div class="tags" role="group" aria-labelledby="tag-label">
								<button
									class="chip"
									class:active={!data.view.tag}
									aria-pressed={!data.view.tag}
									onclick={() => setView({ tag: null })}
								>
									All
								</button>
								{#each data.tags as tag (tag.id)}
									<button
										class="chip"
										class:active={data.view.tag === tag.id}
										aria-pressed={data.view.tag === tag.id}
										onclick={() => setView({ tag: tag.id })}
									>
										{tag.name}
									</button>
								{/each}
							</div>
						</div>
					{/if}
					<label class="filter-group sort">
						<span class="filter-label">Sort</span>
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
			{/if}
		</aside>

		<section class="photos" aria-live="polite">
			{#if data.descriptionHtml}
				<div class="prose description">{@html data.descriptionHtml}</div>
			{/if}

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
					<ImageIcon size={24} strokeWidth={1} />
					{#if data.view.tag}
						<p>No photos have this tag yet.</p>
						<button class="btn btn-sm" onclick={() => setView({ tag: null })}
							>Show All Photos</button
						>
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
							<p class="loading" aria-live="polite">
								<span class="spinner"></span> Loading more photos…
							</p>
						{/if}
						<p class="progress">
							{photos.length.toLocaleString()} / {total.toLocaleString()}
						</p>
					{:else}
						<p class="done">
							<span>End</span>
							<span>
								{total === 1
									? 'That’s the only photo'
									: `You’ve seen all ${total.toLocaleString()} photos`}
							</span>
						</p>
					{/if}
				</div>
			{/if}
		</section>
	</div>
</main>

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

{#if selecting}
	<div class="selection-bar" transition:fly={{ y: 40, duration: 200 }}>
		<div class="selection-inner">
			<span class="selection-count">
				<strong>{selected.size.toLocaleString()}</strong> selected
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
	/* ---- top bar */

	.topbar {
		position: sticky;
		top: 0;
		z-index: 40;
		background: var(--bg);
		border-bottom: var(--rule);
	}

	.topbar .inner {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 1rem;
		height: 48px;
	}

	.back {
		min-width: 0;
		color: var(--text);
	}

	.top-title {
		font-weight: 600;
		letter-spacing: -0.02em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 44vw;
	}

	.top-count {
		justify-self: end;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}

	.home-label {
		max-width: 22vw;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.home-label {
			display: none;
		}

		.topbar .inner {
			grid-template-columns: auto minmax(0, 1fr) auto;
		}

		.top-title {
			max-width: none;
			justify-self: center;
		}
	}

	/* ---- admin strip */

	.admin-bar {
		border-bottom: 1px dashed var(--border-strong);
		background: var(--surface);
	}

	.admin-inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem 1.5rem;
		padding-block: 0.6rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.admin-inner span {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.admin-links {
		gap: 1.5rem !important;
	}

	.flag {
		font-style: normal;
		font-size: 0.66rem;
		text-transform: uppercase;
		padding: 0.1rem 0.4rem;
		background: var(--warning);
		color: var(--bg);
	}

	/* ---- title */

	.intro {
		row-gap: 1rem;
		padding-block: clamp(1.25rem, 3vw, 2.5rem) clamp(2rem, 5vw, 3.5rem);
	}

	.intro-meta {
		display: flex;
		gap: 2.5rem;
		padding-top: 0.6rem;
		border-top: var(--rule);
	}

	h1 {
		font-size: clamp(2.5rem, 8.5vw, 9rem);
		font-weight: 650;
		line-height: 0.88;
		letter-spacing: -0.055em;
		margin-left: -0.04em;
		max-width: 16ch;
		animation: index-wipe 0.45s var(--ease) both;
	}

	/* ---- the meta column and the photos */

	.body {
		row-gap: 2rem;
		align-items: start;
	}

	.meta-col {
		display: grid;
		gap: 1.5rem;
	}

	@media (min-width: 960px) {
		.meta-col {
			grid-column: 1 / span 3;
			position: sticky;
			top: calc(48px + 1.25rem);
			max-height: calc(100svh - 48px - 2.5rem);
			overflow-y: auto;
			scrollbar-width: none;
		}

		.photos {
			grid-column: 4 / -1;
		}
	}

	.facts {
		display: grid;
		margin: 0;
		border-top: var(--rule);
	}

	.facts > div {
		display: grid;
		grid-template-columns: 6rem minmax(0, 1fr);
		align-items: baseline;
		gap: 1rem;
		padding-block: 0.55rem;
		border-bottom: 1px solid var(--border);
	}

	dt,
	.filter-label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	dd {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.82rem;
		font-variant-numeric: tabular-nums;
	}

	.expiry dt,
	.expiry dd {
		color: var(--warning);
	}

	.actions {
		display: grid;
		gap: 0.5rem;
	}

	@media (max-width: 959px) {
		.facts {
			grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		}

		.facts > div {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.15rem;
		}

		.actions {
			grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
		}
	}

	.btn.active {
		--btn-bg: var(--surface);
		--btn-border: var(--text);
	}

	.filters {
		display: grid;
		gap: 1.25rem;
	}

	.filter-group {
		display: grid;
		gap: 0.5rem;
		min-width: 0;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	@media (max-width: 959px) {
		.tags {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
		}
	}

	.chip {
		flex: none;
		min-height: 32px;
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--border-strong);
		background: transparent;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		cursor: pointer;
		transition:
			background-color var(--fast) var(--ease),
			color var(--fast) var(--ease),
			border-color var(--fast) var(--ease);
	}

	.chip:hover {
		border-color: var(--text);
	}

	.chip.active {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-text);
	}

	.sort .select {
		min-height: 38px;
		padding-block: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		background-color: transparent;
	}

	.description {
		margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
		font-size: 1.05rem;
	}

	.empty {
		display: grid;
		justify-items: start;
		gap: 1rem;
		padding: 3rem 0;
		border-top: var(--rule);
		color: var(--text-muted);
	}

	.load-more {
		display: grid;
		justify-items: start;
		gap: 0.75rem;
		margin-top: clamp(2.5rem, 6vw, 4rem);
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.progress {
		font-variant-numeric: tabular-nums;
		color: var(--text-subtle);
	}

	.done {
		display: flex;
		gap: 2rem;
		text-transform: uppercase;
	}

	.done span:first-child {
		color: var(--text);
	}

	/* ---- selection */

	.selection-bar {
		position: fixed;
		left: 50%;
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: 60;
		translate: -50% 0;
		width: min(calc(100% - 2rem), 760px);
		background: var(--bg);
		border: 1px solid var(--text);
		box-shadow: 6px 6px 0 color-mix(in srgb, var(--text) 14%, transparent);
	}

	.selection-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0.5rem 0.5rem 1rem;
	}

	.selection-count {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.selection-count strong {
		color: var(--text);
		font-weight: 600;
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
		background: none;
		cursor: pointer;
		color: var(--text-muted);
	}

	.close:hover {
		background: var(--ink);
		color: var(--bg);
	}

	@media (max-width: 560px) {
		.selection-inner {
			flex-wrap: wrap;
			padding: 0.6rem 0.75rem;
		}

		.selection-actions {
			width: 100%;
			justify-content: space-between;
			gap: 0.75rem;
		}
	}
</style>
