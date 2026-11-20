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
	import AlbumForm from '#lib/components/admin/AlbumForm.svelte';
	import PhotoManager from '#lib/components/admin/PhotoManager.svelte';
	import Maintenance from '#lib/components/admin/Maintenance.svelte';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { formatBytes, formatDateTime } from '#lib/utils.js';
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

	<header class="head">
		<div class="title-block">
			<h1>{album.title}</h1>
			<div class="badges">
				<span class="badge" class:ok={album.isPublic}>{album.isPublic ? 'Public' : 'Private'}</span>
				{#if album.hasPassword}<span class="badge"><Lock size={11} /> Password</span>{/if}
				{#if album.expired}<span class="badge warn">Expired</span>{/if}
				<span class="subtle">{data.stats.count} photos · {formatBytes(data.stats.bytes)}</span>
				{#each data.bookings as booking (booking.id)}
					<a class="badge job" href="/admin/jobs/{booking.id}" title="Linked job">
						<Briefcase size={11} />
						{booking.title}
					</a>
				{/each}
			</div>
		</div>
		<div class="head-actions">
			<button class="btn btn-sm btn-quiet" onclick={copyLink}><Copy size={13} /> Copy link</button>
			<a class="btn btn-sm btn-quiet" href="/{album.slug}" target="_blank" rel="noopener">
				<ExternalLink size={13} /> Open
			</a>
			<a class="btn btn-sm btn-quiet" href="/{album.slug}?preview=1" target="_blank" rel="noopener">
				<Eye size={13} /> Preview as visitor
			</a>
		</div>
	</header>

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
				<a class="link" href="/{album.slug}" target="_blank" rel="noopener"
					><ExternalLink size={13} /> Open in new tab</a
				>
				<a class="link" href="/{album.slug}?preview=1" target="_blank" rel="noopener"
					><Eye size={13} /> Preview as visitors see it</a
				>
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
				<button class="link" onclick={clearAnalytics}>Clear analytics</button>
			</div>
			<div class="metrics">
				<div>
					<strong>{album.views.toLocaleString()}</strong><span class="eyebrow">Page views</span>
				</div>
				<div>
					<strong>{album.photoDownloads.toLocaleString()}</strong><span class="eyebrow"
						>Photo downloads</span
					>
				</div>
				<div>
					<strong>{album.albumDownloads.toLocaleString()}</strong><span class="eyebrow"
						>Album downloads</span
					>
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
			<button class="btn btn-sm btn-danger" onclick={deleteAlbum}
				><Trash2 size={13} /> Delete album</button
			>
		</section>
	</div>
{/key}

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.25rem;
		margin: 1.25rem 0 1.75rem;
	}

	h1 {
		font-size: clamp(2rem, 4vw, 2.8rem);
		word-break: break-word;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
		font-size: 0.82rem;
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

	.head-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
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
