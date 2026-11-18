<script lang="ts">
	import { page } from '$app/state';
	import { fade } from 'svelte/transition';
	import House from '@lucide/svelte/icons/house';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Images from '@lucide/svelte/icons/images';
	import Search from '@lucide/svelte/icons/search';
	import Settings from '@lucide/svelte/icons/settings';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import Receipt from '@lucide/svelte/icons/receipt';
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import DatabaseBackup from '@lucide/svelte/icons/database-backup';
	import Aperture from '@lucide/svelte/icons/aperture';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import FeedbackHost from '#lib/components/admin/FeedbackHost.svelte';
	import CommandPalette from '#lib/components/admin/CommandPalette.svelte';
	import { onMount } from 'svelte';
	import '#lib/components/admin/admin-ui.css';
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
		{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
		{ href: '/admin/albums', label: 'Galleries', icon: Images, exact: false },
		{ href: '/admin/jobs', label: 'Jobs', icon: Briefcase, exact: false },
		{ href: '/admin/invoices', label: 'Invoices', icon: Receipt, exact: false },
		{ href: '/admin/analytics', label: 'Analytics', icon: ChartColumn, exact: false },
		{ href: '/admin/lightroom', label: 'Lightroom', icon: Aperture, exact: false },
		{ href: '/admin/backups', label: 'Backups', icon: DatabaseBackup, exact: false },
		{ href: '/admin/settings', label: 'Settings', icon: Settings, exact: false }
	];

	function active(href: string, exact: boolean) {
		const path = page.url.pathname;
		if (exact) return path === href;
		return path.startsWith(href);
	}

	// Close the mobile menu whenever the route changes.
	$effect(() => {
		void page.url.pathname;
		menuOpen = false;
	});
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

{#snippet navLinks()}
	{#each links as link, i (link.href)}
		<a
			class="tab"
			class:active={active(link.href, link.exact)}
			href={link.href}
			aria-current={active(link.href, link.exact) ? 'page' : undefined}
		>
			<span class="tab-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
			<link.icon size={15} strokeWidth={1.5} />
			<span class="tab-label">{link.label}</span>
		</a>
	{/each}
{/snippet}

<div class="admin">
	<header class="masthead">
		<div class="mast-row">
			<button class="mast-btn menu-button" onclick={() => (menuOpen = true)} aria-label="Open menu">
				<Menu size={19} strokeWidth={1.5} />
			</button>
			<a class="brand" href="/admin">
				<span class="reg-mark" aria-hidden="true"></span>
				<span class="brand-text">
					<span class="brand-title">{data.settings.siteTitle}</span>
					<span class="brand-sub">Lab ledger · Admin</span>
				</span>
			</a>
			<div class="mast-tools">
				<button class="mast-btn search" onclick={openSearch} aria-label="Search">
					<Search size={16} strokeWidth={1.5} />
					<span class="search-label">Search</span>
					<kbd>{shortcut}</kbd>
				</button>
				<a class="mast-btn wide" href="/" target="_blank" rel="noopener">
					<House size={16} strokeWidth={1.5} /> <span>Public Site</span>
				</a>
				<form method="POST" action="/admin/logout">
					<button class="mast-btn wide"
						><LogOut size={16} strokeWidth={1.5} /> <span>Log Out</span></button
					>
				</form>
			</div>
		</div>
		<nav class="tabs" aria-label="Admin">
			{@render navLinks()}
		</nav>
	</header>

	{#if menuOpen}
		<button
			class="overlay"
			aria-label="Close menu"
			onclick={() => (menuOpen = false)}
			transition:fade={{ duration: 120 }}
		></button>
	{/if}

	<aside class="drawer" class:open={menuOpen}>
		<div class="drawer-head">
			<span class="eyebrow">Index</span>
			<button class="mast-btn" onclick={() => (menuOpen = false)} aria-label="Close menu">
				<X size={18} strokeWidth={1.5} />
			</button>
		</div>
		<nav class="drawer-nav" aria-label="Admin menu">
			{@render navLinks()}
		</nav>
		<div class="drawer-foot">
			<a class="tab" href="/" target="_blank" rel="noopener">
				<House size={15} strokeWidth={1.5} /> <span class="tab-label">Public Site</span>
			</a>
			<form method="POST" action="/admin/logout">
				<button class="tab"
					><LogOut size={15} strokeWidth={1.5} /> <span class="tab-label">Log Out</span></button
				>
			</form>
		</div>
	</aside>

	<main class="content cs-content">
		{@render children()}
	</main>
</div>

<FeedbackHost />
<CommandPalette bind:open={searchOpen} />

<style>
	.admin {
		min-height: 100svh;
		display: grid;
		grid-template-rows: auto 1fr;
	}

	/* ---- masthead: brand row over a strip of ledger tabs */

	/* Sticky only on narrow screens (just the 60px bar), as page panels stick at the top on desktop. */
	.masthead {
		position: relative;
		z-index: 40;
		background: var(--bg-elevated);
		border-bottom: var(--rule) solid var(--rule-color);
	}

	.mast-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		height: 58px;
		padding-inline: clamp(1rem, 3vw, 2rem);
		border-bottom: 1px solid var(--border);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		text-decoration: none;
	}

	.brand-text {
		display: grid;
		min-width: 0;
	}

	.brand-title {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 600;
		font-size: 1.15rem;
		line-height: 1.05;
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.brand-sub {
		font-size: 0.6rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--highlight, var(--text-subtle));
	}

	.mast-tools {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-left: auto;
	}

	.mast-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-width: 40px;
		height: 40px;
		padding: 0 0.7rem;
		border: 1px solid var(--border-strong);
		background: none;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition:
			border-color var(--fast) linear,
			color var(--fast) linear;
	}

	.mast-btn:hover {
		border-color: var(--text);
		color: var(--text);
	}

	.search {
		min-width: 220px;
		justify-content: flex-start;
	}

	.search kbd {
		margin-left: auto;
		padding: 0.05rem 0.35rem;
		border: 1px solid var(--border-strong);
		font-size: 0.62rem;
		color: var(--text-subtle);
	}

	.menu-button {
		display: none;
		padding: 0;
	}

	.tabs {
		display: flex;
		gap: 0;
		padding-inline: clamp(1rem, 3vw, 2rem);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tab {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		padding: 0 1rem;
		border: 0;
		border-right: 1px solid var(--border);
		background: none;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color var(--fast) linear,
			color var(--fast) linear;
	}

	.tabs .tab:first-child {
		border-left: 1px solid var(--border);
	}

	.tab-no {
		font-size: 0.6rem;
		color: var(--text-subtle);
	}

	.tab:hover {
		color: var(--text);
		background: var(--surface);
	}

	/* The open tab: page-coloured and joined to the sheet below, with an ink bar on top. */
	.tab.active {
		color: var(--text);
		background: var(--bg);
		box-shadow: inset 0 3px 0 var(--highlight, var(--text));
	}

	.tabs .tab.active::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(-1 * var(--rule));
		height: var(--rule);
		background: var(--bg);
	}

	.tab.active .tab-no {
		color: var(--highlight, var(--text));
	}

	/* ---- drawer (narrow screens) */

	.overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		border: 0;
		background: color-mix(in srgb, var(--bg) 60%, transparent);
	}

	.drawer {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		z-index: 90;
		display: flex;
		flex-direction: column;
		width: min(300px, 86vw);
		border-right: var(--rule) solid var(--rule-color);
		background: var(--bg-elevated);
		transform: translateX(-100%);
		visibility: hidden;
		transition:
			transform var(--slow) var(--ease),
			visibility 0s linear var(--slow);
	}

	.drawer.open {
		transform: none;
		visibility: visible;
		transition: transform var(--slow) var(--ease);
	}

	.drawer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 58px;
		padding: 0 0.75rem 0 1rem;
		border-bottom: 1px solid var(--border);
	}

	.drawer-nav,
	.drawer-foot {
		display: grid;
	}

	.drawer-foot {
		margin-top: auto;
		border-top: var(--rule) solid var(--rule-color);
	}

	.drawer .tab {
		width: 100%;
		min-height: 48px;
		border-right: 0;
		border-bottom: 1px solid var(--border);
	}

	.drawer .tab.active {
		box-shadow: inset 3px 0 0 var(--highlight, var(--text));
	}

	@media (min-width: 1100px) {
		.drawer,
		.overlay {
			display: none;
		}
	}

	@media (max-width: 1099px) {
		.masthead {
			position: sticky;
			top: 0;
		}

		.tabs,
		.wide {
			display: none;
		}

		.menu-button {
			display: inline-flex;
		}

		.search {
			min-width: 0;
		}
	}

	@media (max-width: 640px) {
		.search-label,
		.search kbd,
		.brand .reg-mark {
			display: none;
		}

		.search {
			padding: 0;
		}
	}

	.content {
		min-width: 0;
		width: 100%;
		max-width: 1600px;
		margin: 0 auto;
		padding: clamp(1.5rem, 3.5vw, 2.75rem) clamp(1rem, 3vw, 2rem) 5rem;
	}
</style>
