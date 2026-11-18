<script lang="ts">
	import { page } from '$app/state';
	import { fade } from 'svelte/transition';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Search from '@lucide/svelte/icons/search';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import FeedbackHost from '#lib/components/admin/FeedbackHost.svelte';
	import CommandPalette from '#lib/components/admin/CommandPalette.svelte';
	import { onMount } from 'svelte';
	import '#lib/components/admin/admin-ui.css';
	import { roman } from './format.js';
	import type { LayoutProps } from '../../../routes/admin/(app)/$types';

	let { children, data }: LayoutProps = $props();
	let menuOpen = $state(false);
	let searchOpen = $state(false);
	let shortcut = $state('Ctrl K');
	onMount(() => {
		if (/Mac|iPhone|iPad/.test(navigator.userAgent)) shortcut = '⌘K';
	});

	function openSearch() {
		menuOpen = false;
		searchOpen = true;
	}

	const links = [
		{ href: '/admin', label: 'Dashboard', exact: true },
		{ href: '/admin/albums', label: 'Galleries', exact: false },
		{ href: '/admin/jobs', label: 'Jobs', exact: false },
		{ href: '/admin/invoices', label: 'Invoices', exact: false },
		{ href: '/admin/analytics', label: 'Analytics', exact: false },
		{ href: '/admin/lightroom', label: 'Lightroom', exact: false },
		{ href: '/admin/backups', label: 'Backups', exact: false },
		{ href: '/admin/settings', label: 'Settings', exact: false }
	];

	function active(href: string, exact: boolean) {
		const path = page.url.pathname;
		if (exact) return path === href;
		return path.startsWith(href);
	}

	// Each section is numbered like a chapter; page titles carry the numeral above them.
	const section = $derived(links.findIndex((link) => active(link.href, link.exact)));
	const numeral = $derived(section >= 0 ? roman(section + 1) : '');

	// Close the mobile menu whenever the route changes.
	$effect(() => {
		void page.url.pathname;
		menuOpen = false;
	});
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && menuOpen) menuOpen = false;
	}}
/>

<div class="admin">
	<header class="masthead">
		<div class="top">
			<div class="side left">
				<button
					class="icon-btn menu-button"
					onclick={() => (menuOpen = true)}
					aria-label="Open menu"
				>
					<Menu size={20} strokeWidth={1.25} />
				</button>
				<a class="link wide-only" href="/" target="_blank" rel="noopener">
					Public Site <ArrowUpRight size={13} strokeWidth={1.5} />
				</a>
			</div>
			<a class="brand" href="/admin">
				<span class="brand-kicker sc">The Studio Ledger</span>
				<span class="brand-title">{data.settings.siteTitle}</span>
			</a>
			<div class="side right">
				<button class="search" onclick={openSearch} aria-label="Search">
					<Search size={15} strokeWidth={1.5} />
					<span class="wide-only sc">Search</span>
					<kbd class="wide-only">{shortcut}</kbd>
				</button>
				<form method="POST" action="/admin/logout" class="wide-only">
					<button class="link">Sign Out</button>
				</form>
			</div>
		</div>
		<hr class="double-rule" />
		<nav class="index" aria-label="Admin">
			<ul>
				{#each links as link, i (link.href)}
					<li>
						<a
							href={link.href}
							class="sc"
							class:active={i === section}
							aria-current={i === section ? 'page' : undefined}>{link.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
		<hr class="rule" />
	</header>

	{#if menuOpen}
		<div
			class="contents"
			role="dialog"
			aria-modal="true"
			aria-label="Menu"
			transition:fade={{ duration: 400 }}
		>
			<button class="icon-btn close" onclick={() => (menuOpen = false)} aria-label="Close menu">
				<X size={20} strokeWidth={1.25} />
			</button>
			<p class="eyebrow">Contents</p>
			<ol>
				{#each links as link, i (link.href)}
					<li>
						<a href={link.href} class:active={i === section}>
							<span class="num">{roman(i + 1)}.</span>
							<span class="label">{link.label}</span>
						</a>
					</li>
				{/each}
			</ol>
			<div class="ornament" aria-hidden="true"></div>
			<div class="contents-foot">
				<a class="link" href="/" target="_blank" rel="noopener"
					>Public Site <ArrowUpRight size={13} strokeWidth={1.5} /></a
				>
				<button class="link" onclick={openSearch}>Search</button>
				<form method="POST" action="/admin/logout">
					<button class="link">Sign Out</button>
				</form>
			</div>
		</div>
	{/if}

	<main class="content admin-content" style:--section-numeral={numeral ? `'${numeral}'` : 'none'}>
		{@render children()}
	</main>
</div>

<FeedbackHost />
<CommandPalette bind:open={searchOpen} />

<style>
	.admin {
		min-height: 100svh;
	}

	.masthead {
		padding-inline: clamp(1rem, 4vw, 3rem);
	}

	.top {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 1rem;
		padding-block: 1.25rem 0.9rem;
	}

	.side {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		min-width: 0;
	}

	.side.right {
		justify-content: flex-end;
	}

	.brand {
		display: grid;
		justify-items: center;
		text-align: center;
		text-decoration: none;
		min-width: 0;
	}

	.brand-kicker {
		font-size: 0.92rem;
		letter-spacing: 0.2em;
		margin-right: -0.2em;
		color: var(--highlight, var(--text-subtle));
	}

	.brand-title {
		max-width: 100%;
		font-family: var(--font-display);
		font-style: italic;
		font-size: clamp(1.35rem, 2.6vw, 1.9rem);
		line-height: 1.15;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.search {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		min-height: 40px;
		padding: 0 0.25rem;
		border: 0;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.4s var(--ease);
	}

	.search:hover {
		color: var(--text);
	}

	.search .sc {
		font-size: 1rem;
	}

	kbd {
		padding: 0.05rem 0.4rem;
		border: 1px solid var(--border-strong);
		font-family: var(--font-sans);
		font-size: 0.68rem;
		letter-spacing: 0.04em;
		color: var(--text-subtle);
	}

	.icon-btn {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 0;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}

	.menu-button {
		display: none;
	}

	.rule {
		height: 0;
		margin: 0;
		border: 0;
		border-top: 1px solid var(--border);
	}

	.index ul {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0 0.2rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.index li {
		display: flex;
		align-items: center;
	}

	.index li + li::before {
		content: '·';
		color: var(--text-subtle);
		margin-inline: 0.35rem;
	}

	.index a {
		display: inline-block;
		padding: 0.6rem 0.5rem 0.7rem;
		font-size: 1.05rem;
		color: var(--text-muted);
		text-decoration: underline;
		text-decoration-color: transparent;
		text-decoration-thickness: 1px;
		text-underline-offset: 6px;
		transition:
			color 0.5s var(--ease),
			text-decoration-color 0.5s var(--ease);
	}

	.index a:hover {
		color: var(--text);
	}

	.index a.active {
		color: var(--text);
		text-decoration-color: var(--highlight, currentColor);
	}

	@media (max-width: 1023px) {
		.index,
		.rule,
		.wide-only {
			display: none !important;
		}

		.menu-button {
			display: grid;
		}

		.top {
			padding-block: 0.75rem 0.6rem;
		}

		.brand-kicker {
			font-size: 0.82rem;
		}
	}

	/* -------------------------------------------------------- contents (menu) */

	.contents {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 1.25rem;
		padding: 4rem 1.5rem 2rem;
		overflow-y: auto;
		background: var(--bg);
	}

	.close {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
	}

	.contents ol {
		list-style: none;
		margin: 0;
		padding: 0;
		width: min(100%, 22rem);
	}

	.contents li {
		border-bottom: 1px solid var(--border);
	}

	.contents li:first-child {
		border-top: 1px solid var(--border);
	}

	.contents ol a {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		padding: 0.75rem 0.25rem;
		font-family: var(--font-display);
		font-size: 1.5rem;
		text-decoration: none;
	}

	.contents .num {
		min-width: 2.4em;
		font-size: 1rem;
		letter-spacing: 0.06em;
		color: var(--highlight, var(--text-subtle));
	}

	.contents a.active .label {
		font-style: italic;
	}

	.contents-foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem 1.75rem;
	}

	.content {
		width: 100%;
		max-width: 1280px;
		margin-inline: auto;
		padding: clamp(2rem, 5vw, 3.5rem) clamp(1rem, 4vw, 3rem) 6rem;
	}
</style>
