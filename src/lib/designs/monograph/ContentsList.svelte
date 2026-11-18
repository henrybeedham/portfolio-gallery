<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import Img from '#lib/components/Img.svelte';
	import type { AlbumCardData } from '#lib/types.js';
	import { mediaUrl, plural } from '#lib/utils.js';
	import { roman } from './format.js';

	interface Props {
		albums: AlbumCardData[];
		/** The entry shown in a preview beside the list, if any. */
		current?: number;
		onpreview?: (index: number) => void;
	}

	let { albums, current, onpreview }: Props = $props();
</script>

<!-- A book's table of contents: numeral, title, leader dots, then the count. -->
<ol class="toc">
	{#each albums as album, i (album.id)}
		<li>
			<a
				href="/{album.slug}"
				class:current={current === album.id}
				onpointerenter={() => onpreview?.(i)}
				onfocus={() => onpreview?.(i)}
			>
				<span class="thumb" aria-hidden="true">
					{#if album.cover}
						<Img src={mediaUrl(album.cover, 'thumb')} alt="" />
					{/if}
				</span>
				<span class="num" aria-hidden="true">{roman(i + 1)}.</span>
				<span class="title">
					{album.title}
					{#if album.locked}
						<Lock size={12} strokeWidth={1.75} aria-hidden="true" />
						<span class="visually-hidden">(password protected)</span>
					{/if}
				</span>
				<span class="leader" aria-hidden="true"></span>
				<span class="count">
					{album.count === null ? 'Private' : plural(album.count, 'plate')}
				</span>
			</a>
		</li>
	{/each}
</ol>

<style>
	.toc {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--border);
	}

	.toc li {
		border-bottom: 1px solid var(--border);
	}

	a {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		padding: 1rem 0.25rem;
		text-decoration: none;
		font-size: clamp(1.1rem, 1.8vw, 1.3rem);
	}

	.num {
		flex: none;
		min-width: 2.8em;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		color: var(--highlight, var(--text-subtle));
		font-variant-numeric: lining-nums;
	}

	.title {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	a:hover .title,
	a:focus-visible .title,
	a.current .title {
		font-style: italic;
	}

	.title :global(svg) {
		flex: none;
		color: var(--text-subtle);
	}

	/* Leader dots running to the count. */
	.leader {
		flex: 1;
		min-width: 1.5rem;
		height: 3px;
		align-self: baseline;
		background-image: radial-gradient(circle, var(--text-subtle) 0.9px, transparent 1.2px);
		background-size: 7px 3px;
		background-repeat: repeat-x;
		background-position: left center;
		transform: translateY(-0.25em);
		opacity: 0.8;
	}

	.count {
		flex: none;
		font-family: var(--font-sc);
		font-weight: 600;
		letter-spacing: 0.06em;
		font-size: 0.98rem;
		color: var(--text-muted);
	}

	.thumb {
		display: none;
	}

	@media (max-width: 899px) {
		a {
			align-items: center;
		}

		.thumb {
			display: block;
			flex: none;
			width: 52px;
			height: 52px;
			padding: 5px;
			background: var(--bg-elevated);
			border: 1px solid var(--border);
		}

		.thumb :global(img) {
			width: 100%;
			height: 100%;
			object-fit: cover;
			background: var(--placeholder);
		}

		.num {
			display: none;
		}

		.leader {
			align-self: center;
			transform: none;
		}
	}

	@media (max-width: 420px) {
		a {
			font-size: 1.05rem;
			gap: 0.6rem;
		}

		.leader {
			min-width: 0.75rem;
		}
	}
</style>
