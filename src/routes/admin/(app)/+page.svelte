<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Eye from '@lucide/svelte/icons/eye';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Lock from '@lucide/svelte/icons/lock';
	import Star from '@lucide/svelte/icons/star';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Images from '@lucide/svelte/icons/images';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { formatBytes, formatDateTime, mediaUrl } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let deleting = $state<number | null>(null);

	const stats = $derived([
		{ label: 'Albums', value: data.stats.albums },
		{ label: 'Photos', value: data.stats.photos, note: formatBytes(data.stats.bytes) },
		{ label: 'Page views', value: data.stats.views },
		{ label: 'Photo downloads', value: data.stats.photoDownloads },
		{ label: 'Album downloads', value: data.stats.albumDownloads }
	]);

	async function remove(album: (typeof data.albums)[number]) {
		const confirmed = await feedback.confirm({
			title: `Delete “${album.title}”?`,
			message: `This permanently deletes the album and all ${album.count} photo${album.count === 1 ? '' : 's'}, including the original files. This cannot be undone.`,
			confirmLabel: 'Delete album',
			danger: true
		});
		if (!confirmed) return;
		deleting = album.id;
		try {
			await api(`/admin/api/albums/${album.id}`, undefined, 'DELETE');
			await invalidate('admin:albums');
			feedback.toast(`Deleted “${album.title}”`);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			deleting = null;
		}
	}
</script>

<svelte:head>
	<title>Dashboard — {data.settings.siteTitle}</title>
</svelte:head>

<header class="page-head">
	<div>
		<p class="eyebrow">Overview</p>
		<h1>Dashboard</h1>
	</div>
	<a class="btn btn-solid" href="/admin/albums/new"><Plus size={14} /> New Album</a>
</header>

<section class="stats">
	{#each stats as stat (stat.label)}
		<div class="stat">
			<span class="eyebrow">{stat.label}</span>
			<strong>{stat.value.toLocaleString()}</strong>
			{#if stat.note}<span class="subtle note">{stat.note}</span>{/if}
		</div>
	{/each}
</section>

<section class="panel">
	<div class="panel-head">
		<h2>Albums</h2>
		<span class="subtle">{data.albums.length} total</span>
	</div>

	{#if data.albums.length}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th class="cover-col"><span class="visually-hidden">Cover</span></th>
						<th>Title</th>
						<th>Photos</th>
						<th>Status</th>
						<th>Visibility</th>
						<th>Created</th>
						<th class="actions-col"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.albums as album (album.id)}
						<tr class:muted-row={deleting === album.id}>
							<td class="cover-col">
								<a href="/admin/albums/{album.id}" class="thumb" tabindex="-1">
									{#if album.cover}
										<img src={mediaUrl(album.cover, 'thumb')} alt="" loading="lazy" />
									{:else}
										<ImageIcon size={16} strokeWidth={1.25} />
									{/if}
								</a>
							</td>
							<td>
								<a class="title" href="/admin/albums/{album.id}">{album.title}</a>
								<span class="slug">/{album.slug}</span>
							</td>
							<td class="num">{album.count.toLocaleString()}</td>
							<td>
								<div class="badges">
									<span class="badge" class:ok={album.isPublic}>
										{album.isPublic ? 'Public' : 'Private'}
									</span>
									{#if album.expired}<span class="badge warn">Expired</span>{/if}
									{#if album.locked}
										<span class="badge" title="Password protected"><Lock size={11} /> Password</span
										>
									{/if}
								</div>
							</td>
							<td>
								<div class="badges">
									{#if album.isFeatured}<span class="badge"><Star size={11} /> Featured</span>{/if}
									{#if album.showOnHome}<span class="badge">Homepage</span>{/if}
									{#if album.showOnGalleries}<span class="badge">Galleries</span>{/if}
									{#if !album.isFeatured && !album.showOnHome && !album.showOnGalleries}
										<span class="subtle small">Link only</span>
									{/if}
								</div>
							</td>
							<td class="date">{formatDateTime(album.createdAt)}</td>
							<td class="actions-col">
								<div class="row-actions">
									<a
										class="icon-btn"
										href="/admin/albums/{album.id}"
										title="Edit"
										aria-label="Edit {album.title}"
									>
										<Pencil size={15} strokeWidth={1.5} />
									</a>
									<a
										class="icon-btn"
										href="/{album.slug}"
										target="_blank"
										rel="noopener"
										title="View"
										aria-label="View {album.title}"
									>
										<Eye size={15} strokeWidth={1.5} />
									</a>
									<button
										class="icon-btn danger"
										onclick={() => remove(album)}
										disabled={deleting === album.id}
										title="Delete"
										aria-label="Delete {album.title}"
									>
										{#if deleting === album.id}<span class="spinner"></span>{:else}<Trash2
												size={15}
												strokeWidth={1.5}
											/>{/if}
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="empty">
			<Images size={28} strokeWidth={1} />
			<h3>No albums yet</h3>
			<p class="muted">Create your first album to start uploading photos.</p>
			<a class="btn btn-solid" href="/admin/albums/new"><Plus size={14} /> New Album</a>
		</div>
	{/if}
</section>

<style>
	.page-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 2.25rem;
	}

	h1 {
		font-size: clamp(2.2rem, 4vw, 3rem);
		margin-top: 0.5rem;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 1px;
		background: var(--border);
		border: 1px solid var(--border);
		margin-bottom: 2.5rem;
	}

	.stat {
		display: grid;
		gap: 0.6rem;
		padding: 1.4rem 1.5rem;
		background: var(--bg-elevated);
	}

	.stat strong {
		font-family: var(--font-serif);
		font-size: 2.2rem;
		font-weight: 400;
		line-height: 1;
	}

	.note {
		font-size: 0.78rem;
	}

	.panel {
		border: 1px solid var(--border);
		background: var(--bg-elevated);
	}

	.panel-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--border);
	}

	.panel-head h2 {
		font-size: 1.5rem;
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}

	th {
		text-align: left;
		font-size: 0.64rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-subtle);
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	td {
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	tbody tr {
		transition: background-color 0.15s;
	}

	tbody tr:hover {
		background: color-mix(in srgb, var(--surface) 55%, transparent);
	}

	.muted-row {
		opacity: 0.5;
	}

	.cover-col {
		width: 72px;
		padding-right: 0;
	}

	.thumb {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		overflow: hidden;
		background: var(--placeholder);
		color: var(--text-subtle);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.title {
		display: block;
		font-family: var(--font-serif);
		font-size: 1.08rem;
		text-decoration: none;
	}

	.title:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.slug {
		font-size: 0.78rem;
		color: var(--text-subtle);
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.date {
		white-space: nowrap;
		color: var(--text-muted);
		font-size: 0.82rem;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.18rem 0.5rem;
		border: 1px solid var(--border-strong);
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.badge.ok {
		color: var(--success);
		border-color: color-mix(in srgb, var(--success) 50%, transparent);
	}

	.badge.warn {
		color: var(--warning);
		border-color: color-mix(in srgb, var(--warning) 50%, transparent);
	}

	.small {
		font-size: 0.78rem;
	}

	.actions-col {
		width: 1%;
	}

	.row-actions {
		display: flex;
		gap: 0.25rem;
	}

	.icon-btn {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border: 1px solid transparent;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			border-color 0.15s,
			color 0.15s;
	}

	.icon-btn:hover {
		border-color: var(--border-strong);
		color: var(--text);
	}

	.icon-btn.danger:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 0.85rem;
		padding: 4rem 1rem;
		text-align: center;
		color: var(--text-muted);
	}

	.empty h3 {
		font-size: 1.6rem;
		color: var(--text);
	}

	.empty .btn {
		margin-top: 0.75rem;
	}
</style>
