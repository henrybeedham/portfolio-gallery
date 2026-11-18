<script lang="ts">
	import { page } from '$app/state';

	interface Props {
		title: string;
		/**
		 * `overlay` is the home page's frontispiece masthead (taller, with a line of front matter);
		 * `sticky` is the compact masthead used on inner pages.
		 */
		mode?: 'overlay' | 'sticky';
	}

	let { title, mode = 'sticky' }: Props = $props();

	let scrollY = $state(0);
	let mastheadHeight = $state(0);
	// The running head (a slim centred bar, like a book's) fades in once the masthead has scrolled away.
	const showRunning = $derived(mastheadHeight > 0 && scrollY > mastheadHeight - 8);

	const links = [
		{ href: '/#work', label: 'Work' },
		{ href: '/galleries', label: 'Galleries' },
		{ href: '/#about', label: 'About' }
	];

	function current(href: string) {
		return !href.includes('#') && page.url.pathname === href ? 'page' : undefined;
	}
</script>

<svelte:window bind:scrollY />

<header class="masthead {mode}" bind:offsetHeight={mastheadHeight}>
	<div class="container inner">
		{#if mode === 'overlay'}
			<p class="front-matter sc" aria-hidden="true">Photographs</p>
		{/if}
		<a class="title" href="/">{title}</a>
		<hr class="double-rule" />
		<nav aria-label="Main">
			<ul class="links">
				{#each links as link (link.href)}
					<li><a class="sc" href={link.href} aria-current={current(link.href)}>{link.label}</a></li>
				{/each}
			</ul>
		</nav>
		<hr class="rule" />
	</div>
</header>

<div class="running" class:show={showRunning} aria-hidden={!showRunning} inert={!showRunning}>
	<div class="container running-inner">
		<a class="running-title" href="/">{title}</a>
		<ul class="running-links">
			{#each links as link (link.href)}
				<li><a class="sc" href={link.href}>{link.label}</a></li>
			{/each}
		</ul>
	</div>
</div>

<style>
	.masthead {
		position: relative;
		z-index: 20;
	}

	.inner {
		display: grid;
		justify-items: center;
		text-align: center;
		padding-top: clamp(1.75rem, 4vw, 2.75rem);
	}

	.overlay .inner {
		padding-top: clamp(2rem, 5vw, 3.5rem);
	}

	.front-matter {
		margin-bottom: 0.35rem;
		font-size: 1.05rem;
		color: var(--highlight, var(--text-subtle));
		letter-spacing: 0.22em;
		margin-right: -0.22em;
	}

	.title {
		max-width: 100%;
		padding-inline: 0.5rem;
		font-family: var(--font-display);
		font-size: clamp(2rem, 5.2vw, 3.4rem);
		font-weight: 400;
		line-height: 1.05;
		letter-spacing: 0.01em;
		text-decoration: none;
		overflow-wrap: anywhere;
		text-wrap: balance;
	}

	.overlay .title {
		font-size: clamp(2.4rem, 7vw, 4.6rem);
	}

	.double-rule {
		width: 100%;
		margin-top: clamp(1rem, 2.5vw, 1.5rem);
	}

	.rule {
		width: 100%;
		height: 0;
		margin: 0;
		border: 0;
		border-top: 1px solid var(--border);
	}

	.links {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0 clamp(0.4rem, 2vw, 1.4rem);
		list-style: none;
		margin: 0;
		padding: 0.15rem 0;
	}

	.links li {
		display: flex;
		align-items: center;
		gap: clamp(0.4rem, 2vw, 1.4rem);
	}

	/* A middle dot between entries. */
	.links li + li::before {
		content: '·';
		color: var(--text-subtle);
		font-size: 1.2rem;
		line-height: 1;
	}

	.links a {
		display: inline-block;
		padding: 0.65rem 0.35rem 0.75rem;
		font-size: 1.08rem;
		color: var(--text-muted);
		text-decoration: underline;
		text-decoration-color: transparent;
		text-decoration-thickness: 1px;
		text-underline-offset: 6px;
		transition:
			color 0.5s var(--ease),
			text-decoration-color 0.5s var(--ease);
	}

	.links a:hover,
	.links a[aria-current='page'] {
		color: var(--text);
		text-decoration-color: var(--highlight, currentColor);
	}

	/* ------------------------------------------------------------ running head */

	.running {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 50;
		background: var(--header-bg);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border-bottom: 3px double color-mix(in srgb, var(--border-strong) 80%, transparent);
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.7s var(--ease),
			visibility 0s linear 0.7s;
	}

	.running.show {
		opacity: 1;
		visibility: visible;
		transition: opacity 0.7s var(--ease);
	}

	.running-inner {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		height: 52px;
	}

	.running-title {
		grid-column: 2;
		font-family: var(--font-display);
		font-style: italic;
		font-size: 1.3rem;
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 46vw;
	}

	.running-links {
		grid-column: 3;
		justify-self: end;
		display: flex;
		gap: 1.25rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.running-links a {
		font-size: 0.98rem;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.4s var(--ease);
	}

	.running-links a:hover {
		color: var(--text);
	}

	@media (max-width: 640px) {
		.running-inner {
			grid-template-columns: minmax(0, 1fr);
			justify-items: center;
		}

		.running-title {
			grid-column: 1;
			max-width: 100%;
		}

		.running-links {
			display: none;
		}
	}
</style>
