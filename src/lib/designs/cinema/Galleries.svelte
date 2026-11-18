<script lang="ts">
	import Images from '@lucide/svelte/icons/images';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import CoverMosaic from './CoverMosaic.svelte';
	import { plural } from '#lib/utils.js';
	import type { PageProps } from '../../../routes/galleries/$types';

	let { data }: PageProps = $props();
	const settings = $derived(data.settings);
</script>

<svelte:head>
	<title>Galleries — {settings.siteTitle}</title>
	<meta name="description" content={settings.galleriesIntro} />
</svelte:head>

<SiteHeader title={settings.siteTitle} />

<main>
	<header class="intro container">
		<div class="title fade-up">
			<p class="eyebrow">
				Portfolio{#if data.albums.length}
					· {plural(data.albums.length, 'collection')}{/if}
			</p>
			<h1>Galleries</h1>
		</div>
		{#if settings.galleriesIntro}
			<p class="lede fade-up" style:animation-delay="0.15s">{settings.galleriesIntro}</p>
		{/if}
	</header>

	{#if data.albums.length}
		<CoverMosaic albums={data.albums} eagerCount={3} />
	{:else}
		<div class="empty container">
			<Images size={30} strokeWidth={1} />
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
		gap: 1.5rem;
		padding-block: clamp(2.5rem, 7vw, 5.5rem) clamp(1.75rem, 4vw, 3rem);
	}

	@media (min-width: 900px) {
		.intro {
			grid-template-columns: minmax(0, 1fr) minmax(0, 26rem);
			align-items: end;
			gap: 4rem;
		}
	}

	.title {
		display: grid;
		gap: 0.6rem;
	}

	h1 {
		font-size: clamp(3.6rem, 14vw, 12rem);
		line-height: 0.85;
	}

	.lede {
		font-size: clamp(1rem, 1.4vw, 1.15rem);
		color: var(--text-muted);
		line-height: 1.7;
		max-width: 46ch;
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 1rem;
		padding-block: clamp(3rem, 10vw, 7rem);
		text-align: center;
		color: var(--text-muted);
	}

	.empty h2 {
		font-size: 2.4rem;
		color: var(--text);
	}

	.empty .btn {
		margin-top: 0.5rem;
	}
</style>
