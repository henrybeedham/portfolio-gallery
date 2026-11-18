<script lang="ts">
	import Lock from '@lucide/svelte/icons/lock';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Img from '#lib/components/Img.svelte';
	import type { AlbumCardData } from '#lib/types.js';
	import { formatDay, mediaUrl } from '#lib/utils.js';
	import { formatStampDate, frameNo } from './helpers.js';

	interface Props {
		album: AlbumCardData;
		/** Position in the listing, printed as the roll number. Unnumbered when left out. */
		index?: number;
		/** `card` stacks cover over label (home); `row` is a wide index entry (galleries). */
		variant?: 'card' | 'row';
		eager?: boolean;
	}

	let { album, index, variant = 'card', eager = false }: Props = $props();

	const roll = $derived(index === undefined ? '' : frameNo(index + 1));
	const frames = $derived(album.count === null ? '—' : String(album.count));
</script>

<a class="roll {variant}" href="/{album.slug}">
	<div class="cover-wrap crop-marks">
		<div class="cover">
			{#if album.cover}
				<Img
					src={mediaUrl(album.cover, 'medium')}
					alt=""
					width={album.cover.w || undefined}
					height={album.cover.h || undefined}
					{eager}
				/>
			{:else}
				<div class="placeholder" aria-hidden="true">
					<ImageIcon size={26} strokeWidth={1} />
				</div>
			{/if}
			{#if album.locked}
				<span class="stamp lock">
					<Lock size={11} strokeWidth={2} /> Sealed
				</span>
			{/if}
		</div>
		<span class="rebate" aria-hidden="true">
			<span class="edge">{roll ? `Roll ${roll}` : 'Roll'}</span>
			<span class="edge">▸ {album.count === null ? '' : `${album.count} exp.`}</span>
		</span>
	</div>

	<div class="label">
		{#if roll}<span class="roll-no" aria-hidden="true">{roll}</span>{/if}
		<h3>{album.title}</h3>
		<dl class="meta">
			<div>
				<dt>Date</dt>
				<dd>
					{#if album.date}
						<time datetime={album.date} title={formatDay(album.date)}
							>{formatStampDate(album.date)}</time
						>
					{:else}—{/if}
				</dd>
			</div>
			<div>
				<dt>Frames</dt>
				<dd>{frames}</dd>
			</div>
			<div>
				<dt>Access</dt>
				<dd>{album.locked ? 'Password' : 'Open'}</dd>
			</div>
		</dl>
		{#if variant === 'row'}
			<span class="open">Open Roll <ArrowRight size={13} strokeWidth={1.5} /></span>
		{/if}
	</div>
</a>

<style>
	.roll {
		display: grid;
		gap: 0;
		text-decoration: none;
		color: inherit;
	}

	.cover-wrap {
		display: grid;
		background: var(--film);
		padding: 6px 6px 0;
	}

	.cover {
		position: relative;
		aspect-ratio: 3 / 2;
		overflow: hidden;
		background: var(--placeholder);
	}

	.cover :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.roll:hover .cover :global(img.loaded) {
		filter: brightness(1.08) contrast(1.02);
	}

	.rebate {
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 20px;
		padding-inline: 2px;
	}

	.placeholder {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--text-subtle);
		background:
			linear-gradient(
				135deg,
				transparent calc(50% - 0.5px),
				var(--border-strong) calc(50% - 0.5px) calc(50% + 0.5px),
				transparent calc(50% + 0.5px)
			),
			var(--placeholder);
	}

	.lock {
		position: absolute;
		top: 10px;
		right: 10px;
		background: var(--bg);
		color: var(--text);
		transform: rotate(-3deg);
	}

	.label {
		position: relative;
		display: grid;
		gap: 0.75rem;
		align-content: start;
		padding-top: 0.9rem;
		border-top: var(--rule) solid var(--rule-color);
		margin-top: 0.9rem;
	}

	.roll-no {
		position: absolute;
		top: 0.7rem;
		right: 0;
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 300;
		font-size: 2.2rem;
		line-height: 1;
		color: var(--text-subtle);
	}

	h3 {
		padding-right: 3.5rem;
		font-size: clamp(1.35rem, 2.2vw, 1.75rem);
		line-height: 1;
	}

	.roll:hover h3 {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 4px;
	}

	.meta {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin: 0;
		border-top: 1px solid var(--border);
	}

	.meta div {
		padding: 0.45rem 0.6rem 0 0;
		min-width: 0;
	}

	.meta div + div {
		padding-left: 0.6rem;
		border-left: 1px solid var(--border);
	}

	dt {
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	dd {
		margin: 0;
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.open {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		justify-self: start;
		margin-top: 0.4rem;
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border-bottom: 1px solid currentColor;
	}

	/* Galleries index: a wide entry, cover left and label right. */
	@media (min-width: 720px) {
		.row {
			grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
			gap: clamp(1.5rem, 3vw, 3rem);
			align-items: start;
		}

		.row .label {
			margin-top: 0;
			gap: 1rem;
		}

		.row h3 {
			font-size: clamp(1.8rem, 3.4vw, 3rem);
		}

		.row .roll-no {
			font-size: clamp(2.5rem, 4vw, 3.5rem);
		}

		.row .meta {
			grid-template-columns: minmax(0, 1fr);
		}

		.row .meta div {
			display: flex;
			justify-content: space-between;
			gap: 1rem;
			padding: 0.5rem 0;
			border-left: 0;
			border-bottom: 1px solid var(--border);
		}

		.row .meta div + div {
			padding-left: 0;
		}

		.row dd {
			font-size: 0.86rem;
		}
	}
</style>
