<script lang="ts">
	import { listUrl } from '#lib/components/admin/list-memory.js';
	import { goto, invalidate } from '$app/navigation';
	import BackLink from '#lib/components/admin/BackLink.svelte';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Eye from '@lucide/svelte/icons/eye';
	import Lock from '@lucide/svelte/icons/lock';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Info from '@lucide/svelte/icons/info';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import AlbumForm from '#lib/components/admin/AlbumForm.svelte';
	import PhotoManager from '#lib/components/admin/PhotoManager.svelte';
	import Maintenance from '#lib/components/admin/Maintenance.svelte';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import {
		expiryLabel,
		formatBytes,
		formatDateTime,
		formatDay,
		formatShortDay,
		mediaUrl,
		plural
	} from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Tab = 'photos' | 'details' | 'sharing' | 'maintenance';
	let tab = $state<Tab>('photos');

	const album = $derived(data.album);
	const publicUrl = $derived(`${data.origin}/${album.slug}`);

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'photos', label: 'Photos' },
		{ id: 'details', label: 'Details' },
		{ id: 'sharing', label: 'Sharing & analytics' },
		{ id: 'maintenance', label: 'Maintenance' }
	];

	const cover = $derived(data.photos.find((photo) => photo.id === album.effectiveCoverId));
	const chosenCover = $derived(
		album.coverPhotoId !== null && album.coverPhotoId === album.effectiveCoverId
	);
	const downloads = $derived(album.photoDownloads + album.albumDownloads);

	interface Note {
		tone: 'warn' | 'info';
		text: string;
		action?: { label: string; run: () => void };
	}

	const notes = $derived.by(() => {
		const list: Note[] = [];
		const toDetails = { label: 'Change Expiry', run: () => (tab = 'details') };
		if (album.expired) {
			list.push({
				tone: 'warn',
				text: `Expired on ${formatDateTime(album.expiresAt)}. Visitors can no longer open it.`,
				action: toDetails
			});
		} else if (album.expiresAt && expiryLabel(album.expiresAt)) {
			list.push({
				tone: 'info',
				text: `${expiryLabel(album.expiresAt)}, on ${formatDateTime(album.expiresAt)}.`,
				action: toDetails
			});
		}
		if (!album.isPublic) {
			list.push({
				tone: 'warn',
				text: 'Private. Only you can open it until it’s made public.',
				action: { label: 'Make Public', run: () => setPublic(true) }
			});
		}
		if (!data.stats.count) {
			list.push({
				tone: 'info',
				text: 'No photos yet. Drop some on the Photos tab, or import them from the server folder under Maintenance.'
			});
		} else if (!chosenCover) {
			list.push({
				tone: 'info',
				text: 'No cover chosen, so the first photo stands in. Use the star on any photo to pick one.',
				action: { label: 'Choose Cover', run: () => (tab = 'photos') }
			});
		}
		return list;
	});

	const activity = $derived(data.activity);
	const viewPoints = $derived(
		activity.map((d) => ({ key: d.day, label: formatShortDay(d.day), value: d.views }))
	);
	const downloadPoints = $derived(
		activity.map((d) => ({ key: d.day, label: formatShortDay(d.day), value: d.downloads }))
	);
	const periodViews = $derived(activity.reduce((sum, d) => sum + d.views, 0));
	const periodDownloads = $derived(activity.reduce((sum, d) => sum + d.downloads, 0));
	const periodLabel = $derived(
		activity.length >= 90
			? 'Last 90 days'
			: `Since ${formatShortDay(activity[0]?.day ?? album.createdAt)}`
	);

	let publishing = $state(false);
	async function setPublic(isPublic: boolean) {
		publishing = true;
		try {
			await api(`/admin/api/albums/${album.id}`, { action: 'set-public', isPublic });
			await invalidate('admin:album');
			feedback.toast(isPublic ? 'Album is now public' : 'Album is now private');
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			publishing = false;
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(publicUrl);
			feedback.toast('Link copied to clipboard');
		} catch {
			feedback.toast('Could not access the clipboard', 'error');
		}
	}

	async function clearAnalytics() {
		const ok = await feedback.confirm({
			title: 'Clear analytics?',
			message:
				'Page views and download counts for this album and its photos will be reset to zero.',
			confirmLabel: 'Clear analytics',
			danger: true
		});
		if (!ok) return;
		try {
			await api(`/admin/api/albums/${album.id}`, { action: 'clear-analytics' });
			await invalidate('admin:album');
			feedback.toast('Analytics cleared');
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		}
	}

	async function deleteAlbum() {
		const ok = await feedback.confirm({
			title: `Delete “${album.title}”?`,
			message: `This permanently deletes the album and all ${data.stats.count} photos, including the original files.`,
			confirmLabel: 'Delete album',
			danger: true
		});
		if (!ok) return;
		try {
			await api(`/admin/api/albums/${album.id}`, undefined, 'DELETE');
			feedback.toast(`Deleted “${album.title}”`);
			await goto(listUrl('galleries'));
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		}
	}
</script>

<svelte:head>
	<title>{album.title} — Admin</title>
</svelte:head>

{#key album.id}
	<BackLink list="galleries" label="Galleries" />

	<header class="hero">
		<button
			class="cover"
			class:empty={!cover}
			onclick={() => (tab = 'photos')}
			aria-label={cover ? 'Cover photo; go to photos' : 'No photos yet; go to photos'}
		>
			{#if cover}
				<img src={mediaUrl(cover, 'medium')} alt="" decoding="async" />
				{#if !chosenCover}<span class="cover-note">First photo</span>{/if}
			{:else}
				<ImageIcon size={28} strokeWidth={1} />
			{/if}
		</button>

		<div class="hero-text">
			<p class="eyebrow">
				{album.albumDate
					? formatDay(album.albumDate)
					: `Created ${formatShortDay(album.createdAt)}`}
			</p>
			<h1>{album.title}</h1>
			<div class="badges">
				<span class="badge" class:ok={album.isPublic}>{album.isPublic ? 'Public' : 'Private'}</span>
				{#if album.isPublic && !album.listed}<span class="badge">Unlisted</span>{/if}
				{#if album.hasPassword}<span class="badge"><Lock size={11} /> Password</span>{/if}
				{#if album.expired}<span class="badge warn">Expired</span>{/if}
				{#each data.bookings as booking (booking.id)}
					<a class="badge job" href="/admin/jobs/{booking.id}" title="Linked job">
						<Briefcase size={11} />
						{booking.title}
					</a>
				{/each}
			</div>

			<dl class="stats">
				<div>
					<dt>Photos</dt>
					<dd>{data.stats.count.toLocaleString('en-GB')}</dd>
				</div>
				<div>
					<dt>Size</dt>
					<dd>{formatBytes(data.stats.bytes)}</dd>
				</div>
				<div>
					<dt>Views</dt>
					<dd>{album.views.toLocaleString('en-GB')}</dd>
				</div>
				<div>
					<dt>Downloads</dt>
					<dd>{downloads.toLocaleString('en-GB')}</dd>
				</div>
			</dl>

			<div class="head-actions">
				<button class="btn btn-sm btn-quiet" onclick={copyLink}>
					<Copy size={13} /> Copy Link
				</button>
				<a class="btn btn-sm btn-quiet" href="/{album.slug}" target="_blank" rel="noopener">
					<ExternalLink size={13} /> Open
				</a>
				<a
					class="btn btn-sm btn-quiet"
					href="/{album.slug}?preview=1"
					target="_blank"
					rel="noopener"
				>
					<Eye size={13} /> Preview as Visitor
				</a>
			</div>
		</div>
	</header>

	{#if notes.length}
		<ul class="notes">
			{#each notes as note (note.text)}
				<li class={note.tone}>
					{#if note.tone === 'warn'}
						<TriangleAlert size={15} strokeWidth={1.5} />
					{:else}
						<Info size={15} strokeWidth={1.5} />
					{/if}
					<span>{note.text}</span>
					{#if note.action}
						<button class="link" onclick={note.action.run} disabled={publishing}>
							{note.action.label}
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<div class="tabs" role="tablist">
		{#each tabs as item (item.id)}
			<button
				role="tab"
				class="tab"
				class:active={tab === item.id}
				aria-selected={tab === item.id}
				onclick={() => (tab = item.id)}
			>
				{item.label}
				{#if item.id === 'photos'}<span class="count">{data.stats.count}</span>{/if}
			</button>
		{/each}
	</div>

	<div class="panel" hidden={tab !== 'photos'}>
		<PhotoManager
			albumId={album.id}
			photos={data.photos}
			tags={data.tags}
			sections={data.sections}
			coverPhotoId={album.coverPhotoId}
			backgroundPhotoId={album.backgroundPhotoId}
		/>
	</div>

	<div class="panel narrow" hidden={tab !== 'details'}>
		<AlbumForm
			mode="edit"
			action="?/save"
			initial={data.form}
			themes={data.themes}
			siteTheme={data.siteTheme}
			origin={data.origin}
			hasPassword={album.hasPassword}
			error={form?.error ?? null}
			errorField={form?.field ?? null}
		/>
	</div>

	<div class="panel narrow" hidden={tab !== 'sharing'}>
		<section class="card">
			<h3>Share</h3>
			<div class="share-row">
				<input class="input" readonly value={publicUrl} onfocus={(e) => e.currentTarget.select()} />
				<button class="btn btn-sm btn-solid" onclick={copyLink}><Copy size={13} /> Copy</button>
			</div>
			<div class="share-links">
				<a class="link" href="/{album.slug}" target="_blank" rel="noopener">
					<ExternalLink size={13} /> Open in new tab
				</a>
				<a class="link" href="/{album.slug}?preview=1" target="_blank" rel="noopener">
					<Eye size={13} /> Preview as visitors see it
				</a>
			</div>
			{#if !album.isPublic}
				<p class="hint">
					This album is private — only you can open the link until you make it public.
				</p>
			{:else if album.hasPassword}
				<p class="hint">Visitors will need the album password. Share it alongside the link.</p>
			{/if}
		</section>

		<section class="card">
			<div class="card-head">
				<h3>Analytics</h3>
				<button class="link" onclick={clearAnalytics}>Clear Analytics</button>
			</div>
			<div class="metrics">
				<div>
					<strong>{album.views.toLocaleString('en-GB')}</strong><span class="eyebrow">
						Page views
					</span>
				</div>
				<div>
					<strong>{album.photoDownloads.toLocaleString('en-GB')}</strong><span class="eyebrow">
						Photo downloads
					</span>
				</div>
				<div>
					<strong>{album.albumDownloads.toLocaleString('en-GB')}</strong><span class="eyebrow">
						Album downloads
					</span>
				</div>
			</div>
			<div class="charts">
				<div>
					<h4 class="chart-title">
						Views <span>{periodLabel} · {plural(periodViews, 'view')}</span>
					</h4>
					<LineChart
						label="Views per day, {periodLabel.toLowerCase()}"
						unit="views"
						points={viewPoints}
						height={170}
						empty="A chart appears after the album’s second day."
					/>
				</div>
				<div>
					<h4 class="chart-title">
						Downloads <span>{periodLabel} · {plural(periodDownloads, 'download')}</span>
					</h4>
					<LineChart
						label="Downloads per day, {periodLabel.toLowerCase()}"
						unit="downloads"
						points={downloadPoints}
						color="var(--viz-2)"
						height={170}
						empty="A chart appears after the album’s second day."
					/>
				</div>
			</div>
			<p class="hint">
				Visits and downloads made while you're signed in aren't counted. Created {formatDateTime(
					album.createdAt
				)}.
			</p>
		</section>
	</div>

	<div class="panel narrow" hidden={tab !== 'maintenance'}>
		<Maintenance albumId={album.id} photoCount={data.stats.count} initialJob={data.job} />

		<section class="card danger-zone">
			<div>
				<h3>Delete album</h3>
				<p class="hint">Permanently removes the album, its photos and all original files.</p>
			</div>
			<button class="btn btn-sm btn-danger" onclick={deleteAlbum}>
				<Trash2 size={13} /> Delete album
			</button>
		</section>
	</div>
{/key}

<style>
	.hero {
		display: grid;
		grid-template-columns: minmax(180px, 300px) minmax(0, 1fr);
		gap: 2rem;
		align-items: stretch;
		margin: 1.25rem 0 1.5rem;
	}

	.cover {
		position: relative;
		display: grid;
		place-items: center;
		aspect-ratio: 4 / 5;
		max-height: 340px;
		width: 100%;
		padding: 0;
		border: 1px solid var(--border);
		background: var(--placeholder);
		color: var(--text-subtle);
		overflow: hidden;
		cursor: pointer;
	}

	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 1.2s var(--ease);
	}

	.cover:hover img {
		transform: scale(1.03);
	}

	.cover-note {
		position: absolute;
		left: 8px;
		bottom: 8px;
		padding: 0.15rem 0.45rem;
		background: var(--overlay);
		color: var(--text-muted);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.hero-text {
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-width: 0;
	}

	h1 {
		margin-top: 0.6rem;
		font-size: clamp(2.2rem, 4vw, 3rem);
		word-break: break-word;
	}

	@media (max-width: 720px) {
		.hero {
			grid-template-columns: minmax(0, 1fr);
			gap: 1.25rem;
		}

		.cover {
			aspect-ratio: 3 / 2;
			max-height: 260px;
		}
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.18rem 0.5rem;
		border: 1px solid var(--border-strong);
		font-size: 0.68rem;
		color: var(--text-muted);
	}

	.badge.ok {
		color: var(--success);
		border-color: color-mix(in srgb, var(--success) 50%, transparent);
	}

	.badge.warn {
		color: var(--warning);
		border-color: color-mix(in srgb, var(--warning) 50%, transparent);
	}

	.badge.job {
		text-decoration: none;
	}

	.badge.job:hover {
		border-color: var(--text);
		color: var(--text);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin: 1.5rem 0;
		border-block: 1px solid var(--border);
	}

	.stats div {
		display: grid;
		gap: 0.35rem;
		padding: 0.9rem 1rem;
	}

	.stats div:first-child {
		padding-left: 0;
	}

	.stats div + div {
		border-left: 1px solid var(--border);
	}

	.stats dt {
		font-size: 0.64rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.stats dd {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 1.6rem;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	@container (max-width: 640px) {
		.stats {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.stats div:nth-child(3) {
			padding-left: 0;
			border-left: 0;
		}

		.stats div:nth-child(n + 3) {
			border-top: 1px solid var(--border);
		}
	}

	.head-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.notes {
		display: grid;
		list-style: none;
		margin: 0 0 1.5rem;
		padding: 0;
		border: 1px solid var(--border);
		border-left: 0;
		background: var(--bg-elevated);
	}

	.notes li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.75rem;
		padding: 0.7rem 1rem;
		border-left: 2px solid var(--text-subtle);
		font-size: 0.88rem;
		color: var(--text-muted);
	}

	.notes li + li {
		border-top: 1px solid var(--border);
	}

	.notes li > span {
		flex: 1 1 16rem;
	}

	.notes li :global(svg) {
		flex: none;
		color: var(--text-subtle);
	}

	.notes li.warn {
		border-left-color: var(--warning);
		background: color-mix(in srgb, var(--warning) 6%, transparent);
	}

	.notes li.warn :global(svg) {
		color: var(--warning);
	}

	.notes .link {
		margin-left: auto;
		font-size: 0.66rem;
	}

	.tabs {
		display: flex;
		gap: 0.25rem;
		overflow-x: auto;
		border-bottom: 1px solid var(--border);
		margin-bottom: 1.75rem;
		scrollbar-width: none;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.85rem 1rem;
		border: 0;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		background: none;
		color: var(--text-muted);
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		white-space: nowrap;
		cursor: pointer;
	}

	.tab:hover {
		color: var(--text);
	}

	.tab.active {
		color: var(--text);
		border-bottom-color: var(--text);
	}

	.count {
		padding: 0.05rem 0.4rem;
		background: var(--surface);
		font-size: 0.66rem;
		letter-spacing: 0;
	}

	.panel.narrow {
		max-width: 820px;
	}

	.card {
		display: grid;
		gap: 1rem;
		padding: 1.5rem;
		margin-bottom: 1.25rem;
		border: 1px solid var(--border);
		background: var(--bg-elevated);
	}

	.card h3 {
		font-size: 1.35rem;
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.share-row {
		display: flex;
		gap: 0.5rem;
	}

	.share-row .input {
		font-size: 0.88rem;
	}

	.share-links {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: var(--border);
		border: 1px solid var(--border);
	}

	.metrics div {
		display: grid;
		gap: 0.4rem;
		padding: 1.1rem;
		background: var(--bg);
	}

	.metrics strong {
		font-family: var(--font-serif);
		font-size: 2rem;
		font-weight: 400;
		line-height: 1;
	}

	@media (max-width: 560px) {
		.metrics {
			grid-template-columns: 1fr;
		}
	}

	.charts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
		gap: 1.5rem;
	}

	.chart-title {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.25rem 0.75rem;
		margin-bottom: 0.5rem;
		font-family: var(--font-sans);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.chart-title span {
		color: var(--text-subtle);
		letter-spacing: 0.06em;
		text-transform: none;
	}

	.danger-zone {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		margin-top: 1.25rem;
		border-color: color-mix(in srgb, var(--danger) 45%, transparent);
	}

	.danger-zone h3 {
		color: var(--danger);
	}
</style>
