<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Eye from '@lucide/svelte/icons/eye';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Lock from '@lucide/svelte/icons/lock';
	import Star from '@lucide/svelte/icons/star';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Images from '@lucide/svelte/icons/images';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Rows3 from '@lucide/svelte/icons/rows-3';
	import SearchBox from '#lib/components/admin/SearchBox.svelte';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { chipHref, rememberList } from '#lib/components/admin/list-memory.js';
	import { formatDateTime, matchesSearch, mediaUrl, plural } from '#lib/utils.js';
	import type { PageProps } from './$types';

	type Album = PageProps['data']['albums'][number];

	let { data }: PageProps = $props();
	let deleting = $state<number | null>(null);
	let query = $state(page.url.searchParams.get('q') ?? '');

	// So “← Galleries” on an album's page returns to this filter and search.
	$effect(() => rememberList('galleries', page.url.search));

	// Table or grid, remembered in this browser.
	const VIEW_KEY = 'admin-galleries-view';
	let view = $state<'table' | 'grid'>('table');
	onMount(() => {
		try {
			if (localStorage.getItem(VIEW_KEY) === 'grid') view = 'grid';
		} catch {
			// storage unavailable: stay on the table
		}
	});
	function setView(next: 'table' | 'grid') {
		view = next;
		try {
			localStorage.setItem(VIEW_KEY, next);
		} catch {
			// not remembered, which is fine
		}
	}

	type Filter = 'all' | 'public' | 'private' | 'password' | 'expired';
	const filters: { id: Filter; label: string; test: (a: Album) => boolean }[] = [
		{ id: 'all', label: 'All', test: () => true },
		{ id: 'public', label: 'Public', test: (a) => a.isPublic },
		{ id: 'private', label: 'Private', test: (a) => !a.isPublic },
		{ id: 'password', label: 'Password', test: (a) => a.locked },
		{ id: 'expired', label: 'Expired', test: (a) => a.expired }
	];
	const filter = $derived(
		filters.find((f) => f.id === page.url.searchParams.get('show')) ?? filters[0]
	);

	const matching = $derived(data.albums.filter((a) => matchesSearch(query, a.title, a.slug)));
	const shown = $derived(matching.filter(filter.test));
	const elsewhere = $derived(query.trim() ? matching.length - shown.length : 0);

	function placement(album: Album) {
		return [
			album.isFeatured && 'Featured',
			album.showOnHome && 'Homepage',
			album.showOnGalleries && 'Galleries'
		].filter(Boolean) as string[];
	}

	async function remove(album: Album) {
		const confirmed = await feedback.confirm({
			title: `Delete “${album.title}”?`,
			message: `This permanently deletes the album and all ${plural(album.count, 'photo')}, including the original files. This cannot be undone.`,
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
	<title>Galleries — {data.settings.siteTitle}</title>
</svelte:head>

<header class="ui-head">
	<div>
		<p class="eyebrow">Albums</p>
		<h1>Galleries</h1>
	</div>
	<div class="ui-actions">
		<a class="btn btn-solid" href="/admin/albums/new"><Plus size={14} /> New Album</a>
	</div>
</header>

{#snippet badges(album: Album)}
	<span class="ui-badge" class:ok={album.isPublic}>{album.isPublic ? 'Public' : 'Private'}</span>
	{#if album.expired}<span class="ui-badge warn">Expired</span>{/if}
	{#if album.locked}
		<span class="ui-badge" title="Password protected"><Lock size={11} /> Password</span>
	{/if}
{/snippet}

{#snippet actions(album: Album)}
	<div class="ui-row-actions">
		<a
			class="ui-icon-btn"
			href="/admin/albums/{album.id}"
			title="Edit"
			aria-label="Edit {album.title}"
		>
			<Pencil size={15} strokeWidth={1.5} />
		</a>
		<a
			class="ui-icon-btn"
			href="/{album.slug}"
			target="_blank"
			rel="noopener"
			title="View"
			aria-label="View {album.title}"
		>
			<Eye size={15} strokeWidth={1.5} />
		</a>
		<button
			class="ui-icon-btn danger"
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
{/snippet}

<section class="ui-panel">
	<div class="ui-panel-head">
		<SearchBox bind:value={query} label="Search galleries" placeholder="Search title or address" />
		<div class="controls">
			<nav class="ui-chips" aria-label="Filter galleries">
				{#each filters as item (item.id)}
					<a
						class="ui-chip"
						class:active={filter.id === item.id}
						href={chipHref('/admin/albums', item.id === 'all' ? null : item.id, query)}
						data-sveltekit-noscroll
						data-sveltekit-replacestate
					>
						{item.label} <span class="ui-count">{matching.filter(item.test).length}</span>
					</a>
				{/each}
			</nav>
			<div class="toggle" role="group" aria-label="Layout">
				<button
					class="ui-icon-btn"
					class:on={view === 'table'}
					aria-pressed={view === 'table'}
					onclick={() => setView('table')}
					title="Table"
					aria-label="Show as a table"
				>
					<Rows3 size={15} strokeWidth={1.5} />
				</button>
				<button
					class="ui-icon-btn"
					class:on={view === 'grid'}
					aria-pressed={view === 'grid'}
					onclick={() => setView('grid')}
					title="Grid"
					aria-label="Show as a grid"
				>
					<LayoutGrid size={15} strokeWidth={1.5} />
				</button>
			</div>
		</div>
	</div>

	{#if shown.length && view === 'grid'}
		<ul class="grid">
			{#each shown as album (album.id)}
				<li class="card" class:ui-faded={deleting === album.id}>
					<a href="/admin/albums/{album.id}" class="cover" tabindex="-1" aria-hidden="true">
						{#if album.cover}
							<img src={mediaUrl(album.cover, 'thumb')} alt="" loading="lazy" />
						{:else}
							<ImageIcon size={22} strokeWidth={1.25} />
						{/if}
					</a>
					<div class="card-body">
						<a class="ui-title" href="/admin/albums/{album.id}">{album.title}</a>
						<span class="ui-sub">/{album.slug} · {plural(album.count, 'photo')}</span>
						<div class="ui-badges">{@render badges(album)}</div>
					</div>
					<div class="card-actions">{@render actions(album)}</div>
				</li>
			{/each}
		</ul>
	{:else if shown.length}
		<div class="ui-table-wrap">
			<table class="ui-table">
				<thead>
					<tr>
						<th class="cover-col"><span class="visually-hidden">Cover</span></th>
						<th>Title</th>
						<th class="ui-num">Photos</th>
						<th>Status</th>
						<th>Visibility</th>
						<th>Created</th>
						<th class="ui-shrink"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each shown as album (album.id)}
						{@const places = placement(album)}
						<tr class:ui-faded={deleting === album.id}>
							<td class="cover-col">
								<a href="/admin/albums/{album.id}" class="thumb" tabindex="-1" aria-hidden="true">
									{#if album.cover}
										<img src={mediaUrl(album.cover, 'thumb')} alt="" loading="lazy" />
									{:else}
										<ImageIcon size={16} strokeWidth={1.25} />
									{/if}
								</a>
							</td>
							<td>
								<a class="ui-title" href="/admin/albums/{album.id}">{album.title}</a>
								<span class="ui-sub">/{album.slug}</span>
							</td>
							<td class="ui-num">{album.count.toLocaleString()}</td>
							<td><div class="ui-badges">{@render badges(album)}</div></td>
							<td>
								<div class="ui-badges">
									{#each places as place (place)}
										<span class="ui-badge">
											{#if place === 'Featured'}<Star size={11} />{/if}
											{place}
										</span>
									{:else}
										<span class="ui-sub">Link only</span>
									{/each}
								</div>
							</td>
							<td class="date">{formatDateTime(album.createdAt)}</td>
							<td class="ui-shrink">{@render actions(album)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if data.albums.length}
		<div class="ui-empty">
			<h3>Nothing here</h3>
			{#if query.trim()}
				<p>No {filter.id === 'all' ? '' : `“${filter.label}” `}galleries match “{query.trim()}”.</p>
			{:else}
				<p>No galleries match “{filter.label}”.</p>
			{/if}
		</div>
	{:else}
		<div class="ui-empty">
			<Images size={28} strokeWidth={1} />
			<h3>No albums yet</h3>
			<p>Create your first album to start uploading photos.</p>
			<div class="ui-inline">
				<a class="btn btn-solid" href="/admin/albums/new"><Plus size={14} /> New Album</a>
			</div>
		</div>
	{/if}
	{#if elsewhere > 0}
		<p class="ui-elsewhere">
			{plural(elsewhere, 'more match', 'more matches')} in other filters.
			<a href={chipHref('/admin/albums', null, query)} data-sveltekit-noscroll
				>Search all galleries</a
			>
		</p>
	{/if}
</section>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
	}

	.toggle {
		display: flex;
		gap: 0.25rem;
	}

	.toggle .on {
		border-color: var(--border-strong);
		color: var(--text);
	}

	.cover-col {
		width: 72px;
		padding-right: 0 !important;
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

	.thumb img,
	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.date {
		white-space: nowrap;
		color: var(--text-muted);
		font-size: 0.82rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
		gap: 1px;
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--border);
	}

	.card {
		display: grid;
		grid-template-rows: auto 1fr auto;
		background: var(--bg-elevated);
		transition: opacity 0.2s var(--ease);
	}

	.cover {
		display: grid;
		place-items: center;
		aspect-ratio: 4 / 3;
		overflow: hidden;
		background: var(--placeholder);
		color: var(--text-subtle);
	}

	.cover img {
		transition: transform 0.6s var(--ease);
	}

	.card:hover .cover img {
		transform: scale(1.03);
	}

	.card-body {
		display: grid;
		align-content: start;
		gap: 0.35rem;
		padding: 0.9rem 1rem 0.5rem;
		min-width: 0;
	}

	.card-body .ui-sub {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-body .ui-badges {
		margin-top: 0.3rem;
	}

	.card-actions {
		padding: 0 0.6rem 0.6rem;
	}
</style>
