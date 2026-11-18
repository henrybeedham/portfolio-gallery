<script lang="ts">
	import Images from '@lucide/svelte/icons/images';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import AlbumCard from '#lib/components/AlbumCard.svelte';
	import Masonry from '#lib/components/Masonry.svelte';
	import { matchesSearch, plural } from '#lib/utils.js';
	import type { AlbumCardData } from '#lib/types.js';
	import type { PageProps } from '../../../routes/galleries/$types';

	let { data }: PageProps = $props();
	const settings = $derived(data.settings);

	type Order = 'newest' | 'oldest' | 'title';
	const ORDERS: { value: Order; label: string }[] = [
		{ value: 'newest', label: 'Newest' },
		{ value: 'oldest', label: 'Oldest' },
		{ value: 'title', label: 'A–Z' }
	];

	let query = $state('');
	let order = $state<Order>('newest');

	// Purely client-side: the server already sends every public gallery, newest first.
	const shown = $derived.by(() => {
		const list: AlbumCardData[] = data.albums.filter((album) => matchesSearch(query, album.title));
		if (order === 'oldest') return [...list].reverse();
		if (order === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title));
		return list;
	});
</script>

<svelte:head>
	<title>Galleries — {settings.siteTitle}</title>
	<meta name="description" content={settings.galleriesIntro} />
</svelte:head>

<SiteHeader title={settings.siteTitle} />

<main class="container">
	<header class="intro fade-up">
		<span class="kicker"
			><Images size={14} strokeWidth={2} />
			{plural(data.albums.length, 'gallery', 'galleries')}</span
		>
		<h1>Galleries</h1>
		{#if settings.galleriesIntro}
			<p class="lede">{settings.galleriesIntro}</p>
		{/if}
	</header>

	{#if data.albums.length}
		<div class="filters fade-up" style:animation-delay="0.08s">
			<label class="search">
				<Search size={16} strokeWidth={2} />
				<span class="visually-hidden">Search galleries</span>
				<input type="search" placeholder="Search galleries" bind:value={query} />
				{#if query}
					<button
						type="button"
						class="clear"
						onclick={() => (query = '')}
						aria-label="Clear search"
					>
						<X size={14} strokeWidth={2} />
					</button>
				{/if}
			</label>
			<div class="segmented" role="group" aria-label="Sort galleries">
				{#each ORDERS as option (option.value)}
					<button
						type="button"
						class:active={order === option.value}
						aria-pressed={order === option.value}
						onclick={() => (order = option.value)}>{option.label}</button
					>
				{/each}
			</div>
		</div>

		{#if shown.length}
			{#key order}
				<Masonry
					items={shown}
					ratio={(album) =>
						(album.cover?.w && album.cover?.h ? album.cover.h / album.cover.w : 1.25) + 0.2}
					key={(album) => album.id}
					breakpoints={[
						[0, 1],
						[560, 2],
						[980, 3]
					]}
					gap="clamp(0.75rem, 1.6vw, 1.25rem)"
				>
					{#snippet children(album, index)}
						<AlbumCard {album} shape="natural" eager={index < 3} />
					{/snippet}
				</Masonry>
			{/key}
		{:else}
			<div class="empty">
				<span class="empty-icon"><Search size={22} strokeWidth={2} /></span>
				<h2>No matches</h2>
				<p class="muted">Nothing is called “{query}”. Try another word.</p>
				<button class="btn" onclick={() => (query = '')}>Clear Search</button>
			</div>
		{/if}
	{:else}
		<div class="empty">
			<span class="empty-icon"><Images size={22} strokeWidth={2} /></span>
			<h2>No galleries yet</h2>
			<p class="muted">New collections will be published here soon.</p>
			<a class="btn" href="/">Back to Home</a>
		</div>
	{/if}
</main>

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

<style>
	.intro {
		display: grid;
		justify-items: start;
		gap: 1rem;
		padding-block: clamp(2.5rem, 7vw, 5rem) clamp(1.5rem, 3vw, 2.25rem);
		max-width: 52rem;
	}

	h1 {
		font-size: clamp(2.6rem, 7vw, 4.8rem);
		font-weight: 800;
		letter-spacing: -0.045em;
		line-height: 1;
	}

	.lede {
		font-size: clamp(1.02rem, 1.5vw, 1.2rem);
		color: var(--text-muted);
		max-width: 52ch;
		line-height: 1.6;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: clamp(1.25rem, 3vw, 2rem);
	}

	.search {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1 1 260px;
		max-width: 420px;
		min-height: 46px;
		padding: 0 0.5rem 0 1rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-pill);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-sm);
		color: var(--text-subtle);
		transition:
			border-color var(--dur-fast) var(--ease),
			box-shadow var(--dur-fast) var(--ease);
	}

	.search:focus-within {
		border-color: var(--ink);
		box-shadow: 0 0 0 4px var(--ring);
	}

	.search input {
		flex: 1;
		min-width: 0;
		height: 44px;
		border: 0;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: 0.95rem;
		outline: none;
	}

	.search input::-webkit-search-cancel-button {
		display: none;
	}

	.clear {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: 50%;
		background: var(--surface);
		cursor: pointer;
	}

	.segmented {
		display: inline-flex;
		gap: 2px;
		padding: 4px;
		border: 1px solid var(--edge);
		border-radius: var(--radius-pill);
		background: var(--surface);
	}

	.segmented button {
		min-height: 36px;
		padding: 0 1rem;
		border: 0;
		border-radius: var(--radius-pill);
		background: none;
		color: var(--text-muted);
		font-size: 0.86rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background-color var(--dur) var(--ease),
			color var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}

	.segmented button:hover {
		color: var(--text);
	}

	.segmented button.active {
		background: var(--bg-elevated);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		padding: clamp(3rem, 10vw, 6rem) 1rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-xl);
		background: var(--bg-elevated);
		text-align: center;
		color: var(--text-muted);
	}

	.empty-icon {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--surface);
		color: var(--text);
	}

	.empty h2 {
		font-size: 1.5rem;
		color: var(--text);
	}

	.empty .btn {
		margin-top: 0.5rem;
	}
</style>
