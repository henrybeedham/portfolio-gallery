<script lang="ts">
	import { page } from '$app/state';
	import AlbumView from '#lib/components/AlbumView.svelte';
	import PasswordGate from '#lib/components/PasswordGate.svelte';
	import ExpiredNotice from '#lib/components/ExpiredNotice.svelte';
	import { contrastText, mediaUrl } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const settings = $derived(data.settings);
	const album = $derived(data.album);
</script>

<svelte:head>
	<title>{album.title} — {settings.siteTitle}</title>
	<meta property="og:title" content={album.title} />
	<meta property="og:site_name" content={settings.siteTitle} />
	{#if album.hasPassword || !album.isPublic}
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
	<div
		class="album"
		style:--accent={album.accentColor}
		style:--accent-text={contrastText(album.accentColor)}
	>
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
