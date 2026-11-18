<script lang="ts">
	import { fade } from 'svelte/transition';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import Download from '@lucide/svelte/icons/download';
	import Check from '@lucide/svelte/icons/check';
	import type { PhotoItem } from '#lib/types.js';
	import { nativeDownload } from '#lib/download.js';
	import { downloadUrl, mediaUrl } from '#lib/utils.js';
	import { photoTitle, roman } from './format.js';

	interface Props {
		photos: PhotoItem[];
		index: number;
		total: number;
		/** Where `photos[0]` sits in the album, when only part of it is loaded. */
		offset?: number;
		onclose: () => void;
		onnavigate: (index: number) => void;
	}

	let { photos, index, total, offset = 0, onclose, onnavigate }: Props = $props();

	const photo = $derived(photos[index]);
	let touchStart: { x: number; y: number } | null = null;

	const hasPrev = $derived(index > 0);
	const hasNext = $derived(offset + index < total - 1);

	let started = $state(false);

	function download() {
		if (started) return;
		nativeDownload(downloadUrl(photo));
		started = true;
		setTimeout(() => (started = false), 3000);
	}

	function go(delta: number) {
		const target = index + delta;
		if (target < 0 || target >= photos.length) return; // the next page may still be loading
		onnavigate(target);
	}

	function onkeydown(event: KeyboardEvent) {
		// Arrow keys seek within a focused video.
		if (event.key !== 'Escape' && (event.target as Element | null)?.closest?.('video')) return;
		if (event.key === 'ArrowLeft') go(-1);
		else if (event.key === 'ArrowRight') go(1);
		else if (event.key === 'Escape') onclose();
		else return;
		event.preventDefault();
	}

	function ontouchstart(event: TouchEvent) {
		touchStart = null;
		if (event.touches.length !== 1) return;
		const touch = event.touches[0];
		// Swipes over a video's controls along the bottom scrub the video instead.
		const video = (event.target as Element).closest?.('video');
		if (video) {
			const rect = video.getBoundingClientRect();
			if (touch.clientY > rect.bottom - Math.max(64, rect.height * 0.25)) return;
		}
		touchStart = { x: touch.clientX, y: touch.clientY };
	}

	function ontouchend(event: TouchEvent) {
		if (!touchStart) return;
		const dx = event.changedTouches[0].clientX - touchStart.x;
		const dy = event.changedTouches[0].clientY - touchStart.y;
		touchStart = null;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
		else if (dy > 120 && Math.abs(dy) > Math.abs(dx) * 1.5) onclose();
	}

	function onbackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) onclose();
	}

	// Lock page scroll while open.
	$effect(() => {
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});

	// Warm the cache for neighbouring photos.
	$effect(() => {
		for (const neighbour of [photos[index + 1], photos[index - 1]]) {
			if (neighbour) {
				const img = new Image();
				img.src = mediaUrl(neighbour, 'medium');
			}
		}
	});
</script>

<svelte:window {onkeydown} />

{#if photo}
	<div
		class="lightbox"
		role="dialog"
		aria-modal="true"
		aria-label={photo.kind === 'video' ? 'Video viewer' : 'Photo viewer'}
		tabindex="-1"
		transition:fade={{ duration: 250 }}
		{ontouchstart}
		{ontouchend}
	>
		<header class="bar">
			<div class="meta">
				<span class="counter">{offset + index + 1} <em>of</em> {total}</span>
			</div>
			<div class="actions">
				<button class="btn btn-sm light" onclick={download} disabled={started} aria-live="polite">
					{#if started}<Check size={14} />{:else}<Download size={14} />{/if}
					<span
						>{started
							? 'Download Started'
							: photo.kind === 'video'
								? 'Download Video'
								: 'Download Photo'}</span
					>
				</button>
				<button class="icon" onclick={onclose} aria-label="Close viewer">
					<X size={22} strokeWidth={1.25} />
				</button>
			</div>
		</header>

		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="stage" onclick={onbackdrop}>
			{#key photo.id}
				{#if photo.kind === 'video'}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={mediaUrl(photo, 'original')}
						poster={mediaUrl(photo, 'medium')}
						aria-label={photo.name}
						controls
						playsinline
						preload="metadata"
						width={photo.w || undefined}
						height={photo.h || undefined}
						in:fade={{ duration: 600 }}
						style:aspect-ratio={photo.w && photo.h ? `${photo.w} / ${photo.h}` : undefined}
					></video>
				{:else}
					<img
						src={mediaUrl(photo, 'medium')}
						alt={photo.name}
						width={photo.w || undefined}
						height={photo.h || undefined}
						in:fade={{ duration: 600 }}
						style:aspect-ratio={photo.w && photo.h ? `${photo.w} / ${photo.h}` : undefined}
					/>
				{/if}
			{/key}
		</div>

		<p class="caption" aria-live="polite">
			<span class="plate">Plate {roman(offset + index + 1)}</span>
			<em class="name">{photoTitle(photo.name)}</em>
		</p>

		{#if hasPrev}
			<button class="nav prev" onclick={() => go(-1)} aria-label="Previous photo">
				<ChevronLeft size={30} strokeWidth={1} />
			</button>
		{/if}
		{#if hasNext}
			<button
				class="nav next"
				onclick={() => go(1)}
				aria-label="Next photo"
				disabled={index + 1 >= photos.length}
			>
				<ChevronRight size={30} strokeWidth={1} />
			</button>
		{/if}
	</div>
{/if}

<style>
	/* The viewer's chrome is always a pale ivory on the dark ground, whatever the theme. */
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		background: var(--lightbox-bg);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		color: #f3eee6;
		outline: none;
		overscroll-behavior: contain;
		touch-action: pan-y pinch-zoom;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem clamp(1rem, 3vw, 2rem);
	}

	.meta {
		min-width: 0;
	}

	.counter {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-variant-numeric: lining-nums tabular-nums;
		letter-spacing: 0.04em;
		color: rgba(243, 238, 230, 0.75);
	}

	.counter em {
		margin-inline: 0.2rem;
		font-family: var(--font-serif);
		font-size: 0.95rem;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: none;
	}

	.btn.light {
		--btn-fg: #f3eee6;
		--btn-border: rgba(243, 238, 230, 0.4);
	}

	.btn.light:hover:not(:disabled) {
		--btn-bg: #f3eee6;
		--btn-fg: #151412;
		--btn-border: #f3eee6;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		opacity: 0.75;
		transition: opacity 0.4s var(--ease);
	}

	.icon:hover {
		opacity: 1;
	}

	.stage {
		position: relative;
		display: grid;
		grid-template: minmax(0, 1fr) / minmax(0, 1fr);
		place-items: center;
		min-height: 0;
		padding: 14px clamp(0.75rem, 7vw, 6rem);
		cursor: zoom-out;
	}

	.stage img,
	.stage video {
		grid-area: 1 / 1;
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
		cursor: default;
		/* A bevel line, as if the print were matted. */
		outline: 1px solid rgba(243, 238, 230, 0.16);
		outline-offset: 7px;
	}

	.caption {
		display: grid;
		justify-items: center;
		gap: 0.05rem;
		padding: 1.1rem 1rem 1.25rem;
		text-align: center;
		line-height: 1.3;
	}

	.plate {
		font-family: var(--font-sc);
		font-weight: 600;
		font-size: 1rem;
		letter-spacing: 0.1em;
		color: rgba(243, 238, 230, 0.85);
	}

	.name {
		max-width: min(90vw, 40rem);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.98rem;
		color: rgba(243, 238, 230, 0.55);
	}

	.nav {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		display: grid;
		place-items: center;
		width: 56px;
		height: 96px;
		border: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		opacity: 0.55;
		transition: opacity 0.5s var(--ease);
	}

	.nav:hover:not(:disabled) {
		opacity: 1;
	}

	.nav:disabled {
		opacity: 0.25;
		cursor: progress;
	}

	.prev {
		left: clamp(0rem, 1vw, 1rem);
	}

	.next {
		right: clamp(0rem, 1vw, 1rem);
	}

	@media (max-width: 640px) {
		.nav {
			display: none;
		}

		.btn.light span:last-child {
			display: none;
		}

		.btn.light {
			padding-inline: 0.75rem;
		}
	}
</style>
