<script lang="ts">
	import Images from '@lucide/svelte/icons/images';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import AlbumCard from '#lib/components/AlbumCard.svelte';
	import Masonry from '#lib/components/Masonry.svelte';
	import type { PageProps } from '../../../routes/galleries/$types';

	let { data }: PageProps = $props();
	const settings = $derived(data.settings);
</script>

<svelte:head>
	<title>Galleries — {settings.siteTitle}</title>
	<meta name="description" content={settings.galleriesIntro} />
</svelte:head>

<SiteHeader title={settings.siteTitle} />

<main class="container">
	<header class="intro fade-up">
		<p class="eyebrow">Portfolio</p>
		<h1>Galleries</h1>
		{#if settings.galleriesIntro}
			<p class="lede">{settings.galleriesIntro}</p>
		{/if}
	</header>

	{#if data.albums.length}
		<Masonry
			items={data.albums}
			ratio={(album) =>
				(album.cover?.w && album.cover?.h ? album.cover.h / album.cover.w : 1.25) + 0.12}
			key={(album) => album.id}
			breakpoints={[
				[0, 1],
				[640, 2],
				[1040, 3]
			]}
			gap="clamp(1.75rem, 3.5vw, 3rem)"
		>
			{#snippet children(album, index)}
				<AlbumCard {album} shape="natural" eager={index < 3} />
			{/snippet}
		</Masonry>
	{:else}
		<div class="empty">
			<Images size={30} strokeWidth={1} />
			<h2>No galleries yet</h2>
			<p class="muted">New collections will be published here soon.</p>
			<a class="btn" href="/">Back to home</a>
		</div>
	{/if}
</main>

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

<style>
	.intro {
		display: grid;
		gap: 1rem;
		padding-block: clamp(3.5rem, 9vw, 7rem) clamp(2.5rem, 6vw, 4.5rem);
		max-width: 52rem;
	}

	h1 {
		font-size: clamp(3rem, 8vw, 6rem);
		letter-spacing: -0.02em;
	}

	.lede {
		font-size: clamp(1.05rem, 1.6vw, 1.25rem);
		color: var(--text-muted);
		max-width: 48ch;
		line-height: 1.7;
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 1rem;
		padding: clamp(3rem, 10vw, 7rem) 1rem;
		border: 1px solid var(--border);
		text-align: center;
		color: var(--text-muted);
	}

	.empty h2 {
		font-size: 1.8rem;
		color: var(--text);
	}

	.empty .btn {
		margin-top: 0.5rem;
	}
</style>
