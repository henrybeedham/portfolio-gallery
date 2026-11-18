<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import Download from '@lucide/svelte/icons/download';
	import Check from '@lucide/svelte/icons/check';
	import type { PhotoItem } from '#lib/types.js';
	import { nativeDownload } from '#lib/download.js';
	import { downloadUrl, mediaUrl } from '#lib/utils.js';

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
	let direction = $state(1);
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
		direction = delta;
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

	/* ---------------------------------------------------------------- filmstrip */

	let strip = $state<HTMLElement>();

	// Keep the current frame centred in the strip.
	$effect(() => {
		void index;
		const current = strip?.querySelector<HTMLElement>('[aria-current="true"]');
		if (!strip || !current) return;
		const left = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
		strip.scrollTo({ left, behavior: 'smooth' });
	});

	function jump(target: number) {
		if (target === index) return;
		direction = target > index ? 1 : -1;
		onnavigate(target);
	}

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
				<span class="counter"
					><strong>{offset + index + 1}</strong><span class="of">/</span>{total}</span
				>
				<span class="name">{photo.name}</span>
			</div>
			<div class="actions">
				<button
					class="btn btn-sm chrome-btn"
					onclick={download}
					disabled={started}
					aria-live="polite"
				>
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
					<X size={22} strokeWidth={1.5} />
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
						in:fly={{ x: direction * 24, duration: 700, opacity: 0 }}
						style:aspect-ratio={photo.w && photo.h ? `${photo.w} / ${photo.h}` : undefined}
					/>
				{/if}
			{/key}

			{#if hasPrev}
				<button class="nav prev" onclick={() => go(-1)} aria-label="Previous photo">
					<ChevronLeft size={26} strokeWidth={1.25} />
				</button>
			{/if}
			{#if hasNext}
				<button
					class="nav next"
					onclick={() => go(1)}
					aria-label="Next photo"
					disabled={index + 1 >= photos.length}
				>
					<ChevronRight size={26} strokeWidth={1.25} />
				</button>
			{/if}
		</div>

		{#if photos.length > 1}
			<nav class="filmstrip" aria-label="Photos">
				<ol bind:this={strip}>
					{#each photos as item, i (item.id)}
						<li>
							<button
								class="thumb"
								aria-current={i === index}
								aria-label="{item.name} ({offset + i + 1} of {total})"
								onclick={() => jump(i)}
								style:aspect-ratio={item.w && item.h
									? Math.min(2, Math.max(0.6, item.w / item.h))
									: 1.5}
							>
								<img src={mediaUrl(item, 'thumb')} alt="" loading="lazy" decoding="async" />
							</button>
						</li>
					{/each}
				</ol>
			</nav>
		{/if}
	</div>
{/if}

<style>
	/*
	 * The theatre. The viewer is always dark (--lightbox-bg in every theme), so its chrome is the
	 * one place a fixed light colour is used, set once here as --chrome.
	 */
	.lightbox {
		--chrome: #f3eee6;
		--chrome-muted: color-mix(in srgb, var(--chrome) 58%, transparent);
		--chrome-faint: color-mix(in srgb, var(--chrome) 18%, transparent);
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		background: var(--lightbox-bg);
		backdrop-filter: blur(18px);
		-webkit-backdrop-filter: blur(18px);
		color: var(--chrome);
		outline: none;
		overscroll-behavior: contain;
		touch-action: pan-y pinch-zoom;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem clamp(0.75rem, 2.5vw, 1.75rem);
	}

	.meta {
		display: flex;
		align-items: baseline;
		gap: 1.1rem;
		min-width: 0;
	}

	.counter {
		flex: none;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		color: var(--chrome-muted);
	}

	.counter strong {
		font-weight: 500;
		color: var(--chrome);
	}

	.of {
		margin-inline: 0.3rem;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.82rem;
		color: var(--chrome-muted);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: none;
	}

	.btn.chrome-btn {
		--btn-fg: var(--chrome);
		--btn-bg: var(--chrome-faint);
		--btn-border: transparent;
	}

	.btn.chrome-btn:hover:not(:disabled) {
		--btn-bg: var(--chrome);
		--btn-fg: var(--lightbox-bg);
		--btn-border: var(--chrome);
	}

	.icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		background: none;
		color: inherit;
		cursor: pointer;
		transition: background-color 0.3s var(--ease);
	}

	.icon:hover {
		background: var(--chrome-faint);
	}

	.stage {
		position: relative;
		display: grid;
		grid-template: minmax(0, 1fr) / minmax(0, 1fr);
		place-items: center;
		min-height: 0;
		padding: 0 clamp(0rem, 5vw, 5rem);
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
	}

	.nav {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border: 0;
		border-radius: 50%;
		background: var(--chrome-faint);
		color: inherit;
		cursor: pointer;
		opacity: 0.75;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		transition:
			opacity 0.3s var(--ease),
			background-color 0.3s var(--ease);
	}

	.nav:hover:not(:disabled) {
		opacity: 1;
		background: color-mix(in srgb, var(--chrome) 28%, transparent);
	}

	.nav:disabled {
		opacity: 0.25;
		cursor: progress;
	}

	.prev {
		left: clamp(0.5rem, 1.5vw, 1.5rem);
	}

	.next {
		right: clamp(0.5rem, 1.5vw, 1.5rem);
	}

	/* ---------------------------------------------------------------- filmstrip */

	.filmstrip {
		padding: 0.75rem 0 max(0.75rem, env(safe-area-inset-bottom));
	}

	.filmstrip ol {
		display: flex;
		gap: 4px;
		width: fit-content;
		max-width: 100%;
		margin: 0 auto;
		padding: 2px clamp(0.75rem, 2.5vw, 1.75rem);
		list-style: none;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.filmstrip ol::-webkit-scrollbar {
		display: none;
	}

	.thumb {
		display: block;
		height: 58px;
		padding: 0;
		border: 0;
		border-radius: 3px;
		overflow: hidden;
		background: var(--chrome-faint);
		cursor: pointer;
		opacity: 0.4;
		transition:
			opacity 0.4s var(--ease),
			box-shadow 0.4s var(--ease);
	}

	.thumb:hover {
		opacity: 0.8;
	}

	.thumb[aria-current='true'] {
		opacity: 1;
		box-shadow: 0 0 0 2px var(--chrome);
	}

	.thumb:focus-visible {
		outline: 2px solid var(--chrome);
		outline-offset: 2px;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	@media (max-width: 640px) {
		.nav,
		.name {
			display: none;
		}

		.btn.chrome-btn span:last-child {
			display: none;
		}

		.btn.chrome-btn {
			padding-inline: 0.75rem;
		}

		.thumb {
			height: 44px;
		}
	}

	@media (max-height: 520px) {
		.filmstrip {
			display: none;
		}
	}
</style>
