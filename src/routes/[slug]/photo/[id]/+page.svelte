<script lang="ts">
	import { goto, afterNavigate, preloadData } from '$app/navigation';
	import Lightbox from '#lib/components/Lightbox.svelte';
	import { mediaUrl, viewQuery } from '#lib/utils.js';
	import type { PhotoItem } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const album = $derived(data.album);
	const settings = $derived(data.settings);
	const index = $derived(data.index - data.offset);
	const photo = $derived(data.photos[index]);

	let cameFromApp = $state(false);
	afterNavigate(({ from, to, type }) => {
		// Only count arrivals from another page (album or homepage), not photo-to-photo steps.
		if (type === 'enter' || !from || !to) return;
		if (from.route.id !== to.route.id) cameFromApp = true;
	});

	function photoHref(target: PhotoItem) {
		const extra = data.from ? { from: data.from } : undefined;
		return `/${album.slug}/photo/${target.id}${viewQuery(data.view, { sort: album.sortOrder }, extra)}`;
	}

	function close() {
		if (cameFromApp && history.length > 1) {
			history.back();
		} else if (data.from === 'home') {
			goto('/#work');
		} else {
			goto(`/${album.slug}${viewQuery(data.view, { sort: album.sortOrder })}#photo-${photo.id}`);
		}
	}

	function navigate(target: number) {
		goto(photoHref(data.photos[target]), { replace: true, reset: false });
	}

	// Warm up the neighbouring pages for snappy navigation; the viewer warms their images.
	$effect(() => {
		for (const neighbour of [data.photos[index - 1], data.photos[index + 1]]) {
			if (neighbour) preloadData(photoHref(neighbour)).catch(() => {});
		}
	});

	const ogImage = $derived(`${data.origin}${mediaUrl(photo, 'medium')}`);
	// The medium variant fits inside 2048 × 2048.
	const ogScale = $derived(photo.w && photo.h ? Math.min(1, 2048 / Math.max(photo.w, photo.h)) : 0);
	const ogTitle = $derived(`${photo.name} — ${album.title}`);
</script>

<svelte:head>
	<title>{ogTitle} · {settings.siteTitle}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={ogTitle} />
	<meta property="og:site_name" content={settings.siteTitle} />
	<meta property="og:description" content="A photo from {album.title} by {settings.siteTitle}." />
	<meta property="og:url" content="{data.origin}/{album.slug}/photo/{photo.id}" />
	<meta property="og:image" content={ogImage} />
	{#if ogScale}
		<meta property="og:image:width" content={String(Math.round(photo.w * ogScale))} />
		<meta property="og:image:height" content={String(Math.round(photo.h * ogScale))} />
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={ogTitle} />
	<meta name="twitter:image" content={ogImage} />
	{#if data.indexable}
		<link rel="canonical" href="{data.origin}/{album.slug}/photo/{photo.id}" />
		<meta
			name="description"
			content={photo.alt !== album.title && photo.alt
				? photo.alt
				: `A photo from ${album.title} by ${settings.siteTitle}.`}
		/>
	{:else}
		<meta name="robots" content="noindex" />
	{/if}
</svelte:head>

<Lightbox
	photos={data.photos}
	{index}
	offset={data.offset}
	total={data.total}
	onclose={close}
	onnavigate={navigate}
/>
