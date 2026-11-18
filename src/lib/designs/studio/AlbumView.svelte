<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
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
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
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
	// The header card's thumbnail: the album's backdrop image, or its first photo.
	const headerCover = $derived(data.background ?? data.photos[0] ?? null);

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
	<div class="container">
		<div class="inner">
			<a class="back" href="/"
				><ArrowLeft size={16} strokeWidth={2} />
				<span class="home-label">{settings.siteTitle}</span></a
			>
			<span class="top-title">{album.title}</span>
			<span class="top-count">{plural(data.albumCount, 'photo')}</span>
		</div>
	</div>
</header>

{#if data.isAdmin}
	<div class="container">
		<div class="admin-bar">
			{#if data.preview}
				<span><Eye size={15} /> Previewing as a visitor</span>
				<a class="btn btn-sm btn-quiet" href="/{album.slug}">Exit Preview</a>
			{:else}
				<span>
					You’re viewing as the administrator
					{#if data.expired}<em class="flag">Expired</em>{/if}
					{#if !album.isPublic}<em class="flag">Private</em>{/if}
				</span>
				<span class="admin-links">
					<a class="btn btn-sm btn-quiet" href="/{album.slug}?preview=1"
						><Eye size={14} /> Preview</a
					>
					<a class="btn btn-sm btn-quiet" href="/admin/albums/{album.id}"
						><Pencil size={14} /> Edit Album</a
					>
				</span>
			{/if}
		</div>
	</div>
{/if}

<main>
	<section class="container">
		<div class="intro fade-up" class:has-cover={!!headerCover}>
			{#if headerCover}
				<div class="thumb" aria-hidden="true">
					<img src={mediaUrl(headerCover, 'medium')} alt="" />
				</div>
			{/if}
			<div class="intro-body">
				<div class="meta">
					{#if album.albumDate}<span class="pill"
							><CalendarDays size={13} strokeWidth={2} /> {formatDay(album.albumDate)}</span
						>{/if}
					<span class="pill"
						><ImageIcon size={13} strokeWidth={2} /> {plural(data.albumCount, 'photo')}</span
					>
					{#if expiry && !(adminView && data.expired)}
						<span class="pill expiry"><Clock size={13} strokeWidth={2} /> {expiry}</span>
					{/if}
				</div>
				<h1>{album.title}</h1>
				{#if data.descriptionHtml}
					<div class="prose">{@html data.descriptionHtml}</div>
				{/if}
				{#if data.albumCount}
					<div class="actions">
						<button
							class="btn btn-accent"
							onclick={() => startDownload('all')}
							disabled={!!started}
						>
							{#if started === 'all'}<Check size={16} />{:else}<Download size={16} />{/if}
							{started === 'all' ? 'Download Started' : 'Download All'}
						</button>
						<button
							class="btn"
							class:active={selecting}
							aria-pressed={selecting}
							onclick={() => (selecting ? exitSelection() : (selecting = true))}
						>
							<SquareCheck size={16} />
							{selecting ? 'Cancel Selection' : 'Select Photos'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</section>

	{#if data.albumCount}
		<div class="toolbar container">
			{#if data.tags.length}
				<div class="tags" role="group" aria-label="Filter by tag">
					<button class="chip" class:active={!data.view.tag} onclick={() => setView({ tag: null })}>
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
			{:else}
				<span></span>
			{/if}
			<label class="sort">
				<span class="sort-label">Sort</span>
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
				<span class="empty-icon"><ImageIcon size={24} strokeWidth={1.5} /></span>
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
					<p class="done">
						{total === 1
							? 'That’s the only photo'
							: `You’ve seen all ${total.toLocaleString()} photos`}
					</p>
				{/if}
			</div>
		{/if}
	</section>
</main>

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

{#if selecting}
	<div class="selection-bar" transition:fly={{ y: 40, duration: 260, easing: cubicOut }}>
		<div class="selection-inner">
			<span class="selection-count">
				<strong>{selected.size.toLocaleString()}</strong> selected
			</span>
			<div class="selection-actions">
				<button class="btn btn-sm btn-quiet" onclick={selectAll} disabled={selectingAll}>
					{selectingAll ? 'Selecting…' : 'Select All'}
				</button>
				<button
					class="btn btn-sm btn-quiet"
					onclick={() => selected.clear()}
					disabled={!selected.size}>Clear</button
				>
				<button
					class="btn btn-sm btn-accent"
					onclick={downloadSelected}
					disabled={!selected.size || !!started}
				>
					{#if started === 'selection'}<Check size={13} />{:else}<Download size={13} />{/if}
					{started === 'selection' ? 'Download Started' : 'Download'}
				</button>
				<button class="close" onclick={exitSelection} aria-label="Exit selection mode">
					<X size={18} strokeWidth={2} />
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
	/* Floating pill navigation */
	.topbar {
		position: sticky;
		top: 0;
		z-index: 40;
		padding-top: 12px;
		pointer-events: none;
	}

	.topbar .inner {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		height: 56px;
		padding: 0 0.6rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-pill);
		background: var(--header-bg);
		backdrop-filter: blur(18px) saturate(1.4);
		-webkit-backdrop-filter: blur(18px) saturate(1.4);
		box-shadow: var(--shadow-sm);
		pointer-events: auto;
	}

	.back {
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 40px;
		padding: 0 0.9rem 0 0.7rem;
		border-radius: var(--radius-pill);
		font-size: 0.88rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--text-muted);
		transition:
			background-color var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}

	.back:hover {
		background: var(--surface);
		color: var(--text);
	}

	.top-title {
		font-weight: 700;
		font-size: 0.95rem;
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 40vw;
	}

	.top-count {
		justify-self: end;
		padding: 0.3rem 0.8rem;
		border-radius: var(--radius-pill);
		background: var(--surface);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
		white-space: nowrap;
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
			grid-template-columns: auto 1fr;
		}

		.back {
			padding: 0;
			width: 40px;
			justify-content: center;
		}

		.top-title {
			max-width: none;
			justify-self: center;
			margin-right: 40px;
		}
	}

	.admin-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.5rem;
		margin-top: 0.75rem;
		padding: 0.55rem 0.6rem 0.55rem 1.1rem;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--warning) 9%, var(--bg-elevated));
		border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent);
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	.admin-bar span {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.flag {
		font-style: normal;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		padding: 0.15rem 0.55rem;
		border-radius: var(--radius-pill);
		background: var(--warning-soft);
		color: var(--warning);
	}

	/* Header card */
	.intro {
		display: grid;
		gap: clamp(1.25rem, 3vw, 2.25rem);
		align-items: center;
		margin-block: clamp(1.25rem, 3vw, 2rem) clamp(1rem, 2.5vw, 1.5rem);
		padding: clamp(1rem, 2.5vw, 1.5rem);
		border: 1px solid var(--edge);
		border-radius: var(--radius-xl);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-sm);
	}

	@media (min-width: 760px) {
		.intro.has-cover {
			grid-template-columns: clamp(200px, 24vw, 300px) minmax(0, 1fr);
		}
	}

	.thumb {
		aspect-ratio: 4 / 3;
		overflow: hidden;
		border-radius: var(--radius-lg);
		background: var(--placeholder);
	}

	@media (min-width: 760px) {
		.thumb {
			aspect-ratio: 1;
		}
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.intro-body {
		display: grid;
		gap: 1rem;
		justify-items: start;
		padding: 0.25rem clamp(0.25rem, 1.5vw, 1rem) 0.25rem 0.25rem;
		min-width: 0;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 30px;
		padding: 0.25rem 0.75rem;
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.pill.expiry {
		background: var(--warning-soft);
		color: var(--warning);
	}

	h1 {
		font-size: clamp(2rem, 5vw, 3.6rem);
		font-weight: 800;
		letter-spacing: -0.035em;
		line-height: 1.04;
		max-width: 20ch;
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.35rem;
	}

	@media (max-width: 480px) {
		.actions .btn {
			flex: 1 1 100%;
		}
	}

	.btn.active {
		--btn-bg: var(--ink);
		--btn-fg: var(--bg);
	}

	/* Filters */
	.toolbar {
		position: sticky;
		top: 74px;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-block: 0.6rem;
		margin-bottom: 0.5rem;
	}

	.tags {
		display: flex;
		gap: 0.25rem;
		min-width: 0;
		padding: 4px;
		border: 1px solid var(--edge);
		border-radius: var(--radius-pill);
		background: var(--header-bg);
		backdrop-filter: blur(16px) saturate(1.3);
		-webkit-backdrop-filter: blur(16px) saturate(1.3);
		box-shadow: var(--shadow-sm);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.chip {
		flex: none;
		min-height: 34px;
		padding: 0.3rem 0.95rem;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--text-muted);
		font-size: 0.84rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--dur) var(--ease),
			color var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}

	.chip:hover {
		color: var(--text);
		background: var(--surface);
	}

	.chip.active {
		background: var(--accent);
		color: var(--accent-text);
		box-shadow: var(--shadow-sm);
	}

	.sort {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: none;
		padding: 4px 4px 4px 0.9rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-pill);
		background: var(--header-bg);
		backdrop-filter: blur(16px) saturate(1.3);
		-webkit-backdrop-filter: blur(16px) saturate(1.3);
		box-shadow: var(--shadow-sm);
	}

	.sort-label {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-subtle);
	}

	.sort .select {
		min-height: 34px;
		width: auto;
		padding-block: 0.25rem;
		border: 0;
		border-radius: var(--radius-pill);
		background-color: var(--surface);
		box-shadow: none;
		font-size: 0.84rem;
		font-weight: 600;
	}

	@media (max-width: 560px) {
		.sort-label {
			display: none;
		}

		.sort {
			padding-left: 4px;
		}
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 1rem;
		padding: 5rem 1rem;
		border-radius: var(--radius-xl);
		background: var(--bg-elevated);
		border: 1px solid var(--edge);
		color: var(--text-muted);
		text-align: center;
	}

	.empty-icon {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--surface);
		color: var(--text-muted);
	}

	.load-more {
		display: grid;
		justify-items: center;
		gap: 0.85rem;
		padding-top: clamp(2.5rem, 6vw, 4rem);
		font-size: 0.85rem;
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.done {
		padding: 0.45rem 1rem;
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--text-muted);
		font-weight: 600;
	}

	/* Floating selection pill */
	.selection-bar {
		position: fixed;
		left: 50%;
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: 60;
		translate: -50% 0;
		width: min(calc(100% - 1.5rem), 640px);
		border: 1px solid var(--edge);
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
		backdrop-filter: blur(18px) saturate(1.4);
		-webkit-backdrop-filter: blur(18px) saturate(1.4);
		box-shadow: var(--shadow-lg);
	}

	.selection-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.45rem 0.45rem 0.45rem 1.25rem;
	}

	.selection-count {
		font-size: 0.88rem;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.selection-count strong {
		display: inline-grid;
		place-items: center;
		min-width: 28px;
		height: 28px;
		margin-right: 0.25rem;
		padding: 0 0.45rem;
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--accent-text);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.selection-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 50%;
		background: var(--surface);
		cursor: pointer;
		color: var(--text-muted);
		transition:
			background-color var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}

	.close:hover {
		background: var(--surface-strong);
		color: var(--text);
	}

	@media (max-width: 560px) {
		.selection-bar {
			border-radius: var(--radius-lg);
		}

		.selection-inner {
			flex-wrap: wrap;
			padding: 0.6rem;
		}

		.selection-count {
			padding-left: 0.4rem;
		}

		.selection-actions {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
