<script lang="ts">
	import { onMount, tick } from 'svelte';
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
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Play from '@lucide/svelte/icons/play';
	import Img from './Img.svelte';
	import PhotoGallery from './PhotoGallery.svelte';
	import Lightbox from './Lightbox.svelte';
	import SiteFooter from './SiteFooter.svelte';
	import { nativeDownload } from '#lib/download.js';
	import { expiryLabel, formatDay, mediaUrl, plural, viewQuery } from '#lib/utils.js';
	import type { AlbumViewData, PhotoItem, SortOrder, ViewQuery, ViewSection } from '#lib/types.js';

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
	/** Matches the server's page size. */
	const PAGE_SIZE = 48;

	// Infinite scroll: load the next page when a sentinel below the grid nears the viewport.
	// The observer is recreated after each load so a still-visible sentinel triggers again.
	let sentinel = $state<HTMLElement>();
	$effect(() => {
		if (!sentinel || !hasMore || loadingMore || loadError) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) loadMore(loadLimit);
			},
			{ rootMargin: '0px 0px 1200px 0px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	let selecting = $state(false);
	const selected = new SvelteSet<number>();
	let selectingAll = $state(false);

	/** Which download button was just used: a section's id for a section's. */
	let started = $state<'all' | 'selection' | number | null>(null);

	/* --------------------------------------------------------------- sections */

	// Only shown once the view really is split: everything in one section looks like no sections.
	const sectioned = $derived(
		data.sections.length > 1 || (data.sections.length === 1 && data.sections[0].count < data.total)
	);
	const sectionById = $derived(new Map(data.sections.map((section) => [section.id, section])));

	interface Group {
		section: ViewSection | null;
		/** Photos in the group in this view, loaded or not. */
		count: number;
		/** Where the group starts in the view. */
		start: number;
		/** The ones loaded so far. */
		photos: PhotoItem[];
	}

	/** Photos without a section first, with no heading, then every section, loaded or not. */
	const groups = $derived.by((): Group[] => {
		const loose = photos.filter((photo) => !photo.section || !sectionById.has(photo.section));
		const inSections = data.sections.reduce((sum, section) => sum + section.count, 0);
		const result: Group[] = [];
		if (total > inSections) {
			result.push({ section: null, count: total - inSections, start: 0, photos: loose });
		}
		for (const section of data.sections) {
			result.push({
				section,
				count: section.count,
				start: section.start,
				photos: photos.filter((photo) => photo.section === section.id)
			});
		}
		return result;
	});

	/**
	 * Sections the visitor has opened or closed, away from how they start: open, or collapsed to a
	 * few small previews when the album says so.
	 */
	const toggled = new SvelteSet<number>();
	const isOpen = (id: number) => album.sectionsCollapsed === toggled.has(id);

	function toggleSection(id: number) {
		if (toggled.has(id)) toggled.delete(id);
		else toggled.add(id);
	}

	function openSection(id: number) {
		if (!isOpen(id)) toggleSection(id);
	}

	/**
	 * The first open group that still has photos to load. The loader sits at its end, so photos in
	 * collapsed sections are only fetched once they're opened.
	 */
	const loadTarget = $derived(
		sectioned
			? groups.find(
					(group) =>
						(!group.section || isOpen(group.section.id)) && group.photos.length < group.count
				)
			: undefined
	);

	/** Enough to fill the target with a page of photos, skipping past collapsed sections before it. */
	const loadLimit = $derived(
		loadTarget
			? Math.min(
					200,
					Math.max(
						PAGE_SIZE,
						loadTarget.start + loadTarget.photos.length + PAGE_SIZE - photos.length
					)
				)
			: undefined
	);

	function openGroupPhoto(group: Group, index: number) {
		const id = group.photos[index]?.id;
		const at = photos.findIndex((photo) => photo.id === id);
		if (at >= 0) openLightbox(at);
	}

	/** Opens the section and scrolls to its heading; its photos load once it's in view. */
	async function jumpTo(section: ViewSection) {
		openSection(section.id);
		await tick();
		document
			.getElementById(`section-${section.id}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

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

	let pending: Promise<void> | null = null;

	/** Loads the next page, or `limit` photos; a load already under way is shared. */
	function loadMore(limit?: number): Promise<void> {
		if (!hasMore) return Promise.resolve();
		pending ??= fetchMore(limit).finally(() => (pending = null));
		return pending;
	}

	async function fetchMore(limit?: number) {
		loadingMore = true;
		loadError = null;
		try {
			const extra: Record<string, string> = { offset: String(photos.length) };
			if (limit) extra.limit = String(limit);
			const response = await fetch(`/${album.slug}/photos${query(data.view, extra)}`);
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
	function startDownload(
		target: 'all' | 'selection' | number,
		query = '',
		body?: Record<string, string>
	) {
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
		<span class="top-count eyebrow">{plural(data.albumCount, 'photo')}</span>
	</div>
</header>

{#if data.isAdmin}
	<div class="admin-bar container">
		{#if data.preview}
			<span><Eye size={14} /> Previewing as a visitor</span>
			<a class="link" href="/{album.slug}">Exit preview</a>
		{:else}
			<span>
				You're viewing as the administrator
				{#if data.expired}<em class="flag">Expired</em>{/if}
				{#if !album.isPublic}<em class="flag">Private</em>{/if}
			</span>
			<span class="admin-links">
				<a class="link" href="/{album.slug}?preview=1"><Eye size={14} /> Preview</a>
				<a class="link" href="/admin/albums/{album.id}"><Pencil size={14} /> Edit album</a>
			</span>
		{/if}
	</div>
{/if}

<main>
	<section class="intro container">
		<div class="meta eyebrow">
			{#if album.albumDate}<span>{formatDay(album.albumDate)}</span>{/if}
			<span>{plural(data.albumCount, 'photo')}</span>
			{#if expiry && !(adminView && data.expired)}
				<span class="expiry"><Clock size={12} /> {expiry}</span>
			{/if}
		</div>
		<h1 class="fade-up">{album.title}</h1>
		{#if data.descriptionHtml}
			<div class="prose fade-up" style:animation-delay="0.1s">{@html data.descriptionHtml}</div>
		{/if}
		{#if data.albumCount}
			<div class="actions fade-up" style:animation-delay="0.2s">
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
					{selecting ? 'Cancel selection' : 'Select to download'}
				</button>
			</div>
		{/if}
		{#if sectioned && data.tags.length}
			<nav class="contents fade-up" style:animation-delay="0.3s" aria-label="Sections">
				<span class="eyebrow">In this gallery</span>
				<ul>
					{#each data.sections as section (section.id)}
						<li>
							<button class="link" onclick={() => jumpTo(section)}>{section.title}</button>
						</li>
					{/each}
				</ul>
			</nav>
		{/if}
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
			{:else if sectioned}
				<!-- With no tags to filter by, the section links take their place in the sticky bar. -->
				<nav class="tags jump" aria-label="Sections">
					{#each data.sections as section (section.id)}
						<button class="link" onclick={() => jumpTo(section)}>{section.title}</button>
					{/each}
				</nav>
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
		{#if sectioned}
			{#each groups as group (group.section?.id ?? 'none')}
				{@const section = group.section}
				{@const open = !section || isOpen(section.id)}
				{#if section}
					<header class="section-head" id="section-{section.id}">
						<button
							class="section-toggle"
							aria-expanded={open}
							aria-controls="section-photos-{section.id}"
							onclick={() => toggleSection(section.id)}
						>
							<span class="eyebrow">{plural(section.count, 'photo')}</span>
							<span class="section-title">
								<h2>{section.title}</h2>
								<span class="chevron" class:closed={!open}><ChevronDown size={18} /></span>
							</span>
						</button>
						<button
							class="btn btn-sm btn-quiet section-download"
							onclick={() => startDownload(section.id, `?section=${section.id}`)}
							disabled={!!started}
						>
							{#if started === section.id}<Check size={13} />{:else}<Download size={13} />{/if}
							{started === section.id ? 'Download Started' : 'Download Section'}
						</button>
						{#if section.description}
							<p class="section-description">{section.description}</p>
						{/if}
					</header>
				{/if}
				<div class="section-photos" id={section ? `section-photos-${section.id}` : undefined}>
					{#if open}
						{#if group.photos.length}
							<PhotoGallery
								photos={group.photos}
								layout={album.layout}
								href={photoHref}
								onopen={(index) => openGroupPhoto(group, index)}
								{selecting}
								{selected}
								ontoggle={toggle}
								eagerCount={group.start === 0 ? 4 : 0}
							/>
						{/if}
						{#if loadTarget === group}
							<div class="load-more" bind:this={sentinel}>
								{@render loader(false, group.photos.length, group.count)}
							</div>
						{/if}
					{:else if section}
						<button
							class="preview"
							onclick={() => openSection(section.id)}
							aria-label="Show all {plural(section.count, 'photo')} in {section.title}"
						>
							{#each section.preview as photo (photo.id)}
								<span class="preview-tile">
									<Img
										src={mediaUrl(photo, 'thumb')}
										alt=""
										width={photo.w || undefined}
										height={photo.h || undefined}
									/>
									{#if photo.kind === 'video'}
										<span class="preview-play"><Play size={12} strokeWidth={2} /></span>
									{/if}
								</span>
							{/each}
							<span class="preview-more eyebrow">View all</span>
						</button>
					{/if}
				</div>
			{/each}
		{:else if photos.length}
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
					<button class="btn btn-sm" onclick={() => setView({ tag: null })}>Show all photos</button>
				{:else}
					<p>There are no photos in this gallery yet.</p>
				{/if}
			</div>
		{/if}

		{#if photos.length && !sectioned}
			<div class="load-more" bind:this={sentinel}>{@render loader(true)}</div>
		{/if}
	</section>
</main>

{#snippet loader(showDone: boolean, shown = photos.length, of = total)}
	{#if hasMore}
		{#if loadError}
			<p class="error-text">{loadError}</p>
			<button class="btn" onclick={() => loadMore(loadLimit)} disabled={loadingMore}
				>Try again</button
			>
		{:else}
			<p class="subtle loading" aria-live="polite">
				<span class="spinner"></span> Loading more photos…
			</p>
		{/if}
		<p class="subtle">Showing {shown.toLocaleString()} of {of.toLocaleString()}</p>
	{:else if showDone}
		<p class="done eyebrow">
			{total === 1 ? 'That’s the only photo' : `You’ve seen all ${total.toLocaleString()} photos`}
		</p>
	{/if}
{/snippet}

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

{#if selecting}
	<div class="selection-bar" transition:fly={{ y: 80, duration: 300 }}>
		<div class="selection-inner">
			<span class="selection-count">
				<strong>{selected.size.toLocaleString()}</strong> selected
			</span>
			<div class="selection-actions">
				<button class="link" onclick={selectAll} disabled={selectingAll}>
					{selectingAll ? 'Selecting…' : 'Select all'}
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
					{started === 'selection' ? 'Download Started' : 'Download selected'}
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
		backdrop-filter: blur(16px) saturate(1.2);
		-webkit-backdrop-filter: blur(16px) saturate(1.2);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
	}

	.topbar .inner {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		height: 64px;
	}

	.top-title {
		font-family: var(--font-serif);
		font-size: 1.05rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 40vw;
	}

	.top-count {
		justify-self: end;
		font-size: 0.62rem;
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
		padding-block: 0.75rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		border-bottom: 1px dashed var(--border-strong);
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
		font-style: normal;
		font-size: 0.62rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--warning);
		color: var(--warning);
	}

	.intro {
		display: grid;
		gap: 1.5rem;
		justify-items: start;
		padding-block: clamp(3rem, 8vw, 6rem) clamp(2rem, 5vw, 3.5rem);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
	}

	.meta span + span::before {
		content: '';
	}

	.expiry {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--warning);
	}

	h1 {
		font-size: clamp(2.6rem, 7vw, 5.5rem);
		letter-spacing: -0.02em;
		max-width: 18ch;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.btn.active {
		--btn-bg: var(--surface);
		--btn-border: var(--text);
	}

	.toolbar {
		position: sticky;
		top: 64px;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 0.85rem;
		margin-bottom: 1.25rem;
		background: color-mix(in srgb, var(--bg) 86%, transparent);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.tags {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		scrollbar-width: none;
		min-width: 0;
		mask-image: linear-gradient(to right, #000 92%, transparent);
		padding-right: 1.5rem;
	}

	.chip {
		flex: none;
		padding: 0.45rem 0.95rem;
		border: 1px solid var(--border-strong);
		background: transparent;
		font-size: 0.66rem;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background-color 0.2s var(--ease),
			color 0.2s var(--ease),
			border-color 0.2s var(--ease);
	}

	.chip:hover {
		border-color: var(--text);
	}

	.chip.active {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-text);
	}

	.sort {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: none;
	}

	.sort .select {
		min-height: 36px;
		width: auto;
		padding-block: 0.35rem;
		font-size: 0.82rem;
		background-color: transparent;
	}

	@media (max-width: 560px) {
		.sort .eyebrow {
			display: none;
		}
	}

	.contents {
		display: grid;
		gap: 0.6rem;
		margin-top: 0.75rem;
	}

	.contents ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.jump {
		align-items: center;
		gap: 1.5rem;
	}

	.jump .link {
		flex: none;
	}

	.section-head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 0.75rem 1.5rem;
		padding-top: clamp(1.25rem, 2.5vw, 1.75rem);
		margin-bottom: 1.25rem;
		border-top: 1px solid var(--border);
		/* Clears the sticky top bar and toolbar when jumped to. */
		scroll-margin-top: 140px;
	}

	.section-photos + .section-head {
		margin-top: clamp(1.75rem, 4vw, 2.5rem);
	}

	.section-toggle {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.section-title h2 {
		font-size: clamp(1.7rem, 3.6vw, 2.6rem);
		letter-spacing: -0.01em;
		overflow-wrap: anywhere;
	}

	.chevron {
		display: grid;
		flex: none;
		color: var(--text-muted);
		transition: transform 0.5s var(--ease);
	}

	.chevron.closed {
		transform: rotate(-90deg);
	}

	.section-toggle:hover .chevron {
		color: var(--text);
	}

	.preview {
		display: flex;
		gap: clamp(0.25rem, 0.5vw, 0.4rem);
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
	}

	.preview-tile,
	.preview-more {
		position: relative;
		flex: none;
		width: clamp(58px, 9vw, 104px);
		aspect-ratio: 1;
		overflow: hidden;
		background: var(--placeholder);
	}

	.preview-tile :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.8s var(--ease);
	}

	.preview:hover .preview-tile :global(img.loaded) {
		transform: scale(1.04);
	}

	.preview-play {
		position: absolute;
		left: 6px;
		bottom: 6px;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
	}

	.preview-more {
		display: grid;
		place-items: center;
		background: none;
		border: 1px solid var(--border-strong);
		font-size: 0.6rem;
		transition: border-color 0.3s var(--ease);
	}

	.preview:hover .preview-more {
		border-color: var(--text);
	}

	/* Four previews and “View all” fit across a 360px screen. */
	@media (max-width: 560px) {
		.preview-tile:nth-child(n + 5) {
			display: none;
		}
	}

	.section-description {
		grid-column: 1 / -1;
		max-width: 62ch;
		margin: 0;
		color: var(--text-muted);
	}

	@media (max-width: 560px) {
		.section-head {
			grid-template-columns: 1fr;
			align-items: start;
		}

		.section-download {
			justify-self: start;
			grid-row: 3;
		}
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 1rem;
		padding: 5rem 1rem;
		border: 1px solid var(--border);
		color: var(--text-muted);
		text-align: center;
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

	.selection-bar {
		position: fixed;
		left: 50%;
		bottom: max(1rem, env(safe-area-inset-bottom));
		z-index: 60;
		translate: -50% 0;
		width: min(calc(100% - 2rem), 720px);
		background: var(--bg-elevated);
		border: 1px solid var(--border-strong);
		box-shadow: 0 18px 50px rgba(0, 0, 0, 0.14);
	}

	.selection-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem 0.7rem 0.7rem 1.25rem;
	}

	.selection-count {
		font-size: 0.85rem;
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
			padding: 0.75rem 1rem;
		}

		.selection-actions {
			width: 100%;
			justify-content: space-between;
			gap: 0.75rem;
		}
	}
</style>
