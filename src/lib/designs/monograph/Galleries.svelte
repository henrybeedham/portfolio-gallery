<script lang="ts">
	import Images from '@lucide/svelte/icons/images';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import AlbumCard from './AlbumCard.svelte';
	import ContentsList from './ContentsList.svelte';
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
	<header class="intro section-title fade-in">
		<p class="eyebrow">Portfolio</p>
		<h1>Galleries</h1>
		<div class="ornament" aria-hidden="true"></div>
		{#if settings.galleriesIntro}
			<p class="lede">{settings.galleriesIntro}</p>
		{/if}
	</header>

	{#if data.albums.length}
		<section class="contents" aria-labelledby="contents-title">
			<h2 id="contents-title" class="contents-title eyebrow">Contents</h2>
			<ContentsList albums={data.albums} />
		</section>

		<section class="plates" aria-labelledby="plates-title">
			<header class="section-title">
				<span class="numeral" aria-hidden="true">I</span>
				<h2 id="plates-title">The Collections</h2>
				<div class="ornament" aria-hidden="true"></div>
			</header>
			<div class="cards">
				{#each data.albums as album, index (album.id)}
					<AlbumCard {album} number={index + 1} eager={index < 3} />
				{/each}
			</div>
		</section>
	{:else}
		<div class="empty">
			<Images size={28} strokeWidth={1} />
			<h2>No galleries yet</h2>
			<p class="muted">New collections will be published here soon.</p>
			<a class="btn" href="/">Back to Home</a>
		</div>
	{/if}
</main>

<SiteFooter copyright={settings.copyright} isAdmin={data.isAdmin} />

<style>
	.intro {
		padding-block: clamp(3rem, 8vw, 6rem) clamp(2.5rem, 6vw, 4rem);
	}

	h1 {
		font-size: clamp(3rem, 8vw, 5.75rem);
		font-weight: 400;
	}

	.contents {
		max-width: 46rem;
		margin-inline: auto;
	}

	.contents-title {
		margin-bottom: 0.9rem;
		text-align: center;
		font-size: 1.05rem;
		letter-spacing: 0.24em;
	}

	.plates {
		padding-top: clamp(5rem, 11vw, 8.5rem);
	}

	.plates .section-title {
		margin-bottom: clamp(2.5rem, 5vw, 4rem);
	}

	.cards {
		display: grid;
		gap: clamp(2.5rem, 5vw, 4.5rem) clamp(1.25rem, 3.5vw, 3.5rem);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
	}

	@media (min-width: 1100px) {
		.cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 1rem;
		padding: clamp(3rem, 10vw, 7rem) 1rem;
		border-block: 3px double var(--border-strong);
		text-align: center;
		color: var(--text-muted);
	}

	.empty h2 {
		font-size: 2rem;
		font-weight: 400;
		color: var(--text);
	}

	.empty .btn {
		margin-top: 0.5rem;
	}
</style>
