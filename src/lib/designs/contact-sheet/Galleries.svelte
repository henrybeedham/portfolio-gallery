<script lang="ts">
	import Images from '@lucide/svelte/icons/images';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import Roll from './Roll.svelte';
	import { frameNo } from './helpers.js';
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
	<header class="intro">
		<div class="intro-title">
			<p class="eyebrow">Portfolio — roll index</p>
			<h1>Galleries</h1>
		</div>
		<div class="intro-side">
			{#if settings.galleriesIntro}
				<p class="lede">{settings.galleriesIntro}</p>
			{/if}
			<p class="edge">{frameNo(data.albums.length)} rolls on file</p>
		</div>
	</header>

	{#if data.albums.length}
		<ol class="index">
			{#each data.albums as album, index (album.id)}
				<li>
					<Roll {album} {index} variant="row" eager={index < 2} />
				</li>
			{/each}
		</ol>
	{:else}
		<div class="empty">
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
		gap: 1.25rem 4rem;
		align-items: end;
		padding-block: clamp(2.5rem, 7vw, 5rem) clamp(1.5rem, 4vw, 2.5rem);
		margin-bottom: clamp(2rem, 4vw, 3rem);
		border-bottom: var(--rule) solid var(--rule-color);
	}

	@media (min-width: 900px) {
		.intro {
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
		}
	}

	.intro-title {
		display: grid;
		gap: 0.75rem;
	}

	h1 {
		font-size: clamp(3.4rem, 11vw, 9rem);
		line-height: 0.82;
	}

	.intro-side {
		display: grid;
		gap: 1rem;
	}

	.lede {
		font-family: var(--font-sans);
		font-size: clamp(1rem, 1.4vw, 1.12rem);
		color: var(--text-muted);
		max-width: 48ch;
		line-height: 1.65;
	}

	.index {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.index li + li {
		margin-top: clamp(2.5rem, 5vw, 4rem);
		padding-top: clamp(2.5rem, 5vw, 4rem);
		border-top: 1px dashed var(--border-strong);
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 1rem;
		padding: clamp(3rem, 10vw, 7rem) 1rem;
		border: 1px dashed var(--border-strong);
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
