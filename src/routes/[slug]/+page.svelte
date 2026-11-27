<script lang="ts">
	import { page } from '$app/state';
	import AlbumView from '#lib/components/AlbumView.svelte';
	import PasswordGate from '#lib/components/PasswordGate.svelte';
	import ExpiredNotice from '#lib/components/ExpiredNotice.svelte';
	import { mediaUrl } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const settings = $derived(data.settings);
	const album = $derived(data.album);
	const shareImage = $derived(data.shareImage);
	// The medium variant fits inside 2048 × 2048.
	const shareScale = $derived(
		shareImage?.w && shareImage.h ? Math.min(1, 2048 / Math.max(shareImage.w, shareImage.h)) : 0
	);
</script>

<svelte:head>
	<title>{album.title} — {settings.siteTitle}</title>
	<meta property="og:title" content={album.title} />
	<meta property="og:site_name" content={settings.siteTitle} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{data.origin}/{album.slug}" />
	{#if shareImage}
		<meta property="og:image" content="{data.origin}{mediaUrl(shareImage, 'medium')}" />
		{#if shareScale}
			<meta property="og:image:width" content={String(Math.round(shareImage.w * shareScale))} />
			<meta property="og:image:height" content={String(Math.round(shareImage.h * shareScale))} />
		{/if}
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:image" content="{data.origin}{mediaUrl(shareImage, 'medium')}" />
	{/if}
	{#if data.indexable}
		<link rel="canonical" href="{data.origin}/{album.slug}" />
		{#if data.summary}
			<meta name="description" content={data.summary} />
			<meta property="og:description" content={data.summary} />
		{/if}
	{:else}
		<meta name="robots" content="noindex" />
	{/if}
</svelte:head>

{#if data.status === 'locked'}
	<PasswordGate
		title={album.title}
		siteTitle={settings.siteTitle}
		error={form?.error ?? null}
		next={page.url.pathname + page.url.search}
	/>
{:else if data.status === 'expired'}
	<ExpiredNotice title={album.title} expiresAt={album.expiresAt} contact={data.contact} />
{:else}
	<div class="album">
		{#if data.background}
			<div class="backdrop" aria-hidden="true">
				<img src={mediaUrl(data.background, 'thumb')} alt="" />
			</div>
		{/if}

		{#key album.id}
			<AlbumView {data} />
		{/key}
	</div>
{/if}

<style>
	.album {
		position: relative;
		isolation: isolate;
		min-height: 100svh;
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
	}

	.backdrop img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(56px) saturate(1.15);
		transform: scale(1.25);
		opacity: 0.6;
	}

	.backdrop::after {
		content: '';
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--bg) 78%, transparent);
	}
</style>
