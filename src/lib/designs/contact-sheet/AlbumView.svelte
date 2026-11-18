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
	import { formatStampDate, frameNo } from './helpers.js';
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
		<a class="link" href="/"
			><ArrowLeft size={14} /> <span class="home-label">{settings.siteTitle}</span></a
		>
		<span class="top-title">{album.title}</span>
		<span class="top-count edge">{frameNo(data.albumCount)} frames</span>
	</div>
</header>

{#if data.isAdmin}
	<div class="admin-bar container">
		{#if data.preview}
			<span><Eye size={14} /> Previewing as a visitor</span>
			<a class="link" href="/{album.slug}">Exit Preview</a>
		{:else}
			<span>
				You’re viewing as the administrator
				{#if data.expired}<em class="stamp warn">Expired</em>{/if}
				{#if !album.isPublic}<em class="stamp">Private</em>{/if}
			</span>
			<span class="admin-links">
				<a class="link" href="/{album.slug}?preview=1"><Eye size={14} /> Preview</a>
				<a class="link" href="/admin/albums/{album.id}"><Pencil size={14} /> Edit Album</a>
			</span>
		{/if}
	</div>
{/if}

<main>
	<section class="intro container">
		<div class="envelope crop-marks fade-up">
			<div class="env-top">
				<span class="eyebrow">Lab envelope · No. {String(album.id).padStart(4, '0')}</span>
				<span class="reg-mark" aria-hidden="true"></span>
			</div>
			<h1>{album.title}</h1>
			<dl class="fields">
				<div>
					<dt>Date</dt>
					<dd>
						{#if album.albumDate}
							<time datetime={album.albumDate} title={formatDay(album.albumDate)}
								>{formatStampDate(album.albumDate)}</time
							>
						{:else}—{/if}
					</dd>
				</div>
				<div>
					<dt>Frames</dt>
					<dd>{frameNo(data.albumCount)}</dd>
				</div>
				<div>
					<dt>Order</dt>
					<dd>{SORT_LABELS[data.view.sort]}</dd>
				</div>
				<div>
					<dt>Format</dt>
					<dd>{album.layout === 'masonry' ? 'Strips' : 'Sheet'}</dd>
				</div>
			</dl>
			{#if expiry && !(adminView && data.expired)}
				<span class="stamp warn tilt expiry"><Clock size={12} /> {expiry}</span>
			{/if}
		</div>

		<div class="side">
			{#if data.descriptionHtml}
				<div class="prose">{@html data.descriptionHtml}</div>
			{/if}
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
				<p class="hint">
					{selecting
						? 'Tap frames to mark them, then download your selection.'
						: 'Full-resolution files, delivered as a ZIP.'}
				</p>
			{/if}
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
				<span class="eyebrow">Sort</span>
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
					<p class="done edge">
						End of roll ▸
						{total === 1 ? 'that’s the only frame' : `all ${total.toLocaleString()} frames seen`}
					</p>
				{/if}
			</div>
		{/if}
	</section>
</main>

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

{#if selecting}
	<div class="selection-bar" transition:fade={{ duration: 120 }}>
		<div class="selection-inner">
			<span class="selection-count">
				<strong>{frameNo(selected.size)}</strong> marked
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
		background: var(--bg);
		border-bottom: var(--rule) solid var(--rule-color);
	}

	.topbar .inner {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		height: 56px;
	}

	.top-title {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 600;
		font-size: 1.2rem;
		line-height: 1;
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 40vw;
	}

	.top-count {
		justify-self: end;
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

		.top-title {
			max-width: none;
			justify-self: center;
			margin-right: 1.5rem;
		}
	}

	.admin-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.5rem;
		padding-block: 0.7rem;
		font-size: 0.74rem;
		color: var(--text-muted);
		border-bottom: 1px dashed var(--border-strong);
	}

	.admin-bar span {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.admin-links {
		gap: 1.5rem !important;
	}

	.admin-bar .stamp {
		font-style: normal;
		font-size: 0.6rem;
	}

	/* ---- the lab envelope */

	.intro {
		display: grid;
		gap: clamp(1.75rem, 4vw, 3.5rem);
		align-items: start;
		padding-block: clamp(2.5rem, 6vw, 4.5rem) clamp(2rem, 4vw, 3rem);
	}

	@media (min-width: 960px) {
		.intro {
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
		}
	}

	.envelope {
		display: grid;
		gap: 1.25rem;
		margin: 7px;
		padding: clamp(1rem, 2.5vw, 1.75rem);
		border: var(--rule) solid var(--text);
		background: var(--bg-elevated);
	}

	.env-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-strong);
	}

	h1 {
		font-size: clamp(2.6rem, 7vw, 6rem);
		line-height: 0.88;
		overflow-wrap: anywhere;
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin: 0;
		border-top: var(--rule) solid var(--text);
	}

	.fields div {
		min-width: 0;
		padding: 0.55rem 0.75rem 0.1rem;
		border-left: 1px solid var(--border-strong);
	}

	.fields div:first-child {
		padding-left: 0;
		border-left: 0;
	}

	dt {
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	dd {
		margin: 0.15rem 0 0;
		font-size: 0.86rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 560px) {
		.fields {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.fields div:nth-child(3) {
			padding-left: 0;
			border-left: 0;
		}

		.fields div:nth-child(n + 3) {
			border-top: 1px solid var(--border);
		}
	}

	.expiry {
		justify-self: start;
		background: var(--bg-elevated);
	}

	.side {
		display: grid;
		gap: 1.25rem;
		align-content: start;
	}

	@media (min-width: 960px) {
		.side {
			padding-top: 0.5rem;
		}
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.btn.active {
		--btn-bg: var(--surface);
		--btn-border: var(--text);
	}

	/* ---- toolbar */

	.toolbar {
		position: sticky;
		top: 56px;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 0.65rem;
		margin-bottom: 1rem;
		background: var(--bg);
		border-bottom: 1px solid var(--border);
	}

	.tags {
		display: flex;
		gap: 0.35rem;
		overflow-x: auto;
		scrollbar-width: none;
		min-width: 0;
		mask-image: linear-gradient(to right, #000 92%, transparent);
		padding-right: 1.5rem;
	}

	.chip {
		flex: none;
		min-height: 34px;
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--border-strong);
		background: transparent;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background-color var(--fast) linear,
			color var(--fast) linear,
			border-color var(--fast) linear;
	}

	.chip::before {
		content: '[ ';
		color: var(--text-subtle);
	}

	.chip::after {
		content: ' ]';
		color: var(--text-subtle);
	}

	.chip:hover {
		border-color: var(--text);
	}

	.chip.active {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-text);
	}

	.chip.active::before,
	.chip.active::after {
		color: inherit;
	}

	.sort {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex: none;
	}

	.sort .select {
		min-height: 34px;
		width: auto;
		padding-block: 0.3rem;
		font-size: 0.78rem;
		background-color: transparent;
	}

	@media (max-width: 560px) {
		.sort .eyebrow {
			display: none;
		}
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 1rem;
		padding: 5rem 1rem;
		border: 1px dashed var(--border-strong);
		color: var(--text-muted);
		text-align: center;
	}

	.load-more {
		display: grid;
		justify-items: center;
		gap: 0.85rem;
		padding-top: clamp(2rem, 5vw, 3.5rem);
		font-size: 0.8rem;
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
		white-space: normal;
		text-align: center;
	}

	.done::before,
	.done::after {
		content: '';
		width: 40px;
		height: var(--rule);
		background: var(--edge-print);
	}

	/* ---- selection bar */

	.selection-bar {
		position: fixed;
		left: 50%;
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: 60;
		translate: -50% 0;
		width: min(calc(100% - 2rem), 760px);
		background: var(--bg-elevated);
		border: var(--rule) solid var(--text);
	}

	.selection-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.55rem 0.55rem 0.55rem 1rem;
	}

	.selection-count {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.selection-count strong {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-size: 1.7rem;
		font-weight: 600;
		line-height: 1;
		color: var(--grease);
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
		border: 1px solid var(--border-strong);
		background: none;
		cursor: pointer;
		color: var(--text-muted);
	}

	.close:hover {
		color: var(--text);
		border-color: var(--text);
	}

	@media (max-width: 560px) {
		.selection-inner {
			flex-wrap: wrap;
			padding: 0.65rem 0.75rem;
		}

		.selection-actions {
			width: 100%;
			justify-content: space-between;
			gap: 0.75rem;
		}
	}
</style>
