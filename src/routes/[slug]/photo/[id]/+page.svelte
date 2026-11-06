<script lang="ts">
	import { goto, afterNavigate, preloadData } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Download from '@lucide/svelte/icons/download';
	import { downloadWithProgress } from '#lib/download.js';
	import {
		contrastText,
		downloadUrl,
		formatAperture,
		formatBytes,
		formatCaptureTime,
		formatFocal,
		formatShutter,
		mediaUrl,
		viewQuery
	} from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const photo = $derived(data.photo);
	const album = $derived(data.album);
	const settings = $derived(data.settings);

	let cameFromApp = $state(false);
	afterNavigate(({ from, to, type }) => {
		// Only count arrivals from another page (album or homepage), not photo-to-photo steps.
		if (type === 'enter' || !from || !to) return;
		if (from.route.id !== to.route.id) cameFromApp = true;
	});

	function query() {
		return viewQuery(
			data.view,
			{ sort: album.sortOrder },
			data.from ? { from: data.from } : undefined
		);
	}

	const prevHref = $derived(data.prevId ? `/${album.slug}/photo/${data.prevId}${query()}` : null);
	const nextHref = $derived(data.nextId ? `/${album.slug}/photo/${data.nextId}${query()}` : null);
	const albumHref = $derived(
		`/${album.slug}${viewQuery(data.view, { sort: album.sortOrder })}#photo-${photo.id}`
	);

	function back() {
		if (cameFromApp && history.length > 1) {
			history.back();
		} else {
			goto(data.from === 'home' ? '/#work' : albumHref);
		}
	}

	function go(href: string | null) {
		if (href) goto(href, { replace: true, reset: false });
	}

	function onkeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		if (target.closest('input, textarea, select')) return;
		if (event.key === 'ArrowLeft') go(prevHref);
		else if (event.key === 'ArrowRight') go(nextHref);
		else if (event.key === 'Escape') back();
	}

	let touchStart: { x: number; y: number } | null = null;

	function ontouchstart(event: TouchEvent) {
		if (event.touches.length === 1)
			touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
	}

	function ontouchend(event: TouchEvent) {
		if (!touchStart) return;
		const dx = event.changedTouches[0].clientX - touchStart.x;
		const dy = event.changedTouches[0].clientY - touchStart.y;
		touchStart = null;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? nextHref : prevHref);
	}

	let progress = $state<number | null | undefined>(undefined);
	let downloadError = $state<string | null>(null);

	async function download() {
		if (progress !== undefined) return;
		progress = null;
		downloadError = null;
		try {
			await downloadWithProgress(downloadUrl(photo), {
				filename: photo.name,
				onprogress: (p) => (progress = p)
			});
		} catch {
			downloadError = 'The download failed. Please try again.';
		} finally {
			progress = undefined;
		}
	}

	const details = $derived(
		[
			{ label: 'Camera', value: photo.camera },
			{ label: 'Lens', value: photo.lens },
			{ label: 'Focal length', value: formatFocal(photo.focalLength) },
			{ label: 'Aperture', value: formatAperture(photo.aperture) },
			{ label: 'Shutter speed', value: formatShutter(photo.exposureTime) },
			{ label: 'ISO', value: photo.iso ? String(photo.iso) : '' },
			{ label: 'Dimensions', value: photo.w && photo.h ? `${photo.w} × ${photo.h}` : '' },
			{ label: 'File size', value: photo.size ? formatBytes(photo.size) : '' }
		].filter((item) => item.value)
	);

	// Warm up neighbouring photos (data and image) for snappy navigation.
	$effect(() => {
		for (const href of [nextHref, prevHref]) {
			if (!href) continue;
			preloadData(href)
				.then((result) => {
					if (result.type !== 'loaded') return;
					const next = (result.data as { photo?: typeof photo }).photo;
					if (next) new Image().src = mediaUrl(next, 'medium');
				})
				.catch(() => {});
		}
	});

	const ogImage = $derived(`${data.origin}${mediaUrl(photo, 'medium')}`);
	const ogTitle = $derived(`${photo.name} — ${album.title}`);
</script>

<svelte:window {onkeydown} />

<svelte:head>
	<title>{ogTitle} · {settings.siteTitle}</title>
	<meta property="og:type" content="article" />
	<meta property="og:title" content={ogTitle} />
	<meta property="og:site_name" content={settings.siteTitle} />
	<meta property="og:description" content="A photo from {album.title} by {settings.siteTitle}." />
	<meta property="og:url" content="{data.origin}/{album.slug}/photo/{photo.id}" />
	<meta property="og:image" content={ogImage} />
	{#if photo.w && photo.h}
		<meta property="og:image:width" content={String(Math.min(2048, photo.w))} />
		<meta
			property="og:image:height"
			content={String(Math.round((Math.min(2048, photo.w) * photo.h) / photo.w))}
		/>
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={ogTitle} />
	<meta name="twitter:image" content={ogImage} />
	{#if album.hasPassword || !album.isPublic}
		<meta name="robots" content="noindex" />
	{/if}
</svelte:head>

<div
	class="photo-page"
	style:--accent={album.accentColor}
	style:--accent-text={contrastText(album.accentColor)}
>
	<header class="bar container">
		<button class="link" onclick={back}><ArrowLeft size={14} /> Back</button>
		<span class="counter">{data.index + 1} / {data.total}</span>
		<span class="spacer"></span>
	</header>

	<main class="stage" {ontouchstart} {ontouchend}>
		{#if prevHref}
			<a
				class="nav prev"
				href={prevHref}
				data-sveltekit-replacestate
				data-sveltekit-noscroll
				aria-label="Previous photo"
			>
				<ChevronLeft size={30} strokeWidth={1.25} />
			</a>
		{/if}
		{#key photo.id}
			<img
				class="photo"
				src={mediaUrl(photo, 'medium')}
				alt={photo.name}
				width={photo.w || undefined}
				height={photo.h || undefined}
			/>
		{/key}
		{#if nextHref}
			<a
				class="nav next"
				href={nextHref}
				data-sveltekit-replacestate
				data-sveltekit-noscroll
				aria-label="Next photo"
			>
				<ChevronRight size={30} strokeWidth={1.25} />
			</a>
		{/if}
	</main>

	<section class="info container">
		<div class="headline">
			<div>
				<a class="eyebrow album-link" href={albumHref}>{album.title}</a>
				<h1>{photo.name}</h1>
				{#if photo.takenAt}
					<p class="muted">{formatCaptureTime(photo.takenAt)}</p>
				{/if}
			</div>
			<div class="download">
				<button class="btn btn-accent" onclick={download} disabled={progress !== undefined}>
					{#if progress !== undefined}
						<span class="spinner"></span>
						{progress === null ? 'Preparing…' : `Downloading ${Math.round(progress * 100)}%`}
					{:else}
						<Download size={14} /> Download Original
					{/if}
				</button>
				{#if downloadError}<p class="error-text">{downloadError}</p>{/if}
			</div>
		</div>

		{#if details.length}
			<dl class="details">
				{#each details as item (item.label)}
					<div>
						<dt>{item.label}</dt>
						<dd>{item.value}</dd>
					</div>
				{/each}
			</dl>
		{/if}
	</section>
</div>

<style>
	.photo-page {
		min-height: 100svh;
		display: grid;
		grid-template-rows: auto auto auto;
	}

	.bar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		height: 64px;
	}

	.counter {
		font-size: 0.72rem;
		letter-spacing: 0.2em;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.stage {
		position: relative;
		display: grid;
		grid-template: minmax(0, 1fr) / minmax(0, 1fr);
		place-items: center;
		height: calc(100svh - 64px - 5rem);
		min-height: 320px;
		padding: 0 clamp(0.75rem, 7vw, 6rem);
		touch-action: pan-y pinch-zoom;
	}

	.photo {
		max-width: 100%;
		max-height: max(320px, calc(100svh - 64px - 5rem));
		width: auto;
		height: auto;
		object-fit: contain;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.12);
		animation: photo-in 0.5s var(--ease) both;
	}

	@keyframes photo-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.nav {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		display: grid;
		place-items: center;
		width: 56px;
		height: 96px;
		color: var(--text-muted);
		transition:
			color 0.2s,
			transform 0.25s var(--ease);
	}

	.nav:hover {
		color: var(--text);
	}

	.prev {
		left: clamp(0rem, 1.5vw, 1.5rem);
	}

	.prev:hover {
		transform: translateX(-3px);
	}

	.next {
		right: clamp(0rem, 1.5vw, 1.5rem);
	}

	.next:hover {
		transform: translateX(3px);
	}

	@media (max-width: 640px) {
		.nav {
			display: none;
		}

		.stage {
			height: auto;
			min-height: 0;
			padding: 0;
		}

		.photo {
			max-height: 75svh;
		}
	}

	.info {
		display: grid;
		gap: 2.5rem;
		padding-block: 2.5rem 5rem;
	}

	.headline {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1.5rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--border);
	}

	.album-link {
		text-decoration: none;
	}

	.album-link:hover {
		color: var(--text);
	}

	h1 {
		font-size: clamp(1.6rem, 3.4vw, 2.4rem);
		margin-block: 0.6rem 0.4rem;
		word-break: break-word;
	}

	.download {
		display: grid;
		gap: 0.5rem;
		justify-items: end;
	}

	.details {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 1.75rem 2rem;
		margin: 0;
	}

	dt {
		font-size: 0.64rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text-subtle);
		margin-bottom: 0.35rem;
	}

	dd {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 1.15rem;
	}
</style>
