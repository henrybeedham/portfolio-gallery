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

	const initial = $derived(data.settings.siteTitle.trim().charAt(0).toUpperCase() || '·');

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

{#snippet sidebar()}
	<div class="brand">
		<span class="mark" aria-hidden="true">{initial}</span>
		<span class="brand-text">
			<span class="brand-title">{data.settings.siteTitle}</span>
			<span class="brand-sub">Studio admin</span>
		</span>
	</div>
	<button class="search" onclick={openSearch}>
		<Search size={16} strokeWidth={2} />
		<span>Search</span>
		<kbd>{shortcut}</kbd>
	</button>
	<nav>
		<span class="nav-heading">Workspace</span>
		{#each links as link (link.href)}
			<a
				class="nav-link"
				class:active={active(link.href, link.exact)}
				aria-current={active(link.href, link.exact) ? 'page' : undefined}
				href={link.href}
			>
				<span class="nav-icon"><link.icon size={17} strokeWidth={2} /></span>
				{link.label}
			</a>
		{/each}
	</nav>
	<div class="foot">
		<a class="nav-link" href="/" target="_blank" rel="noopener">
			<span class="nav-icon"><House size={17} strokeWidth={2} /></span> Public Homepage
		</a>
		<form method="POST" action="/admin/logout">
			<button class="nav-link"
				><span class="nav-icon"><LogOut size={17} strokeWidth={2} /></span> Logout</button
			>
		</form>
	</div>
{/snippet}

<div class="admin">
	<header class="mobile-bar">
		<div class="mobile-inner">
			<button class="menu-button" onclick={() => (menuOpen = true)} aria-label="Open menu">
				<Menu size={20} strokeWidth={2} />
			</button>
			<span class="brand-title">{data.settings.siteTitle}</span>
			<button class="menu-button search-button" onclick={openSearch} aria-label="Search">
				<Search size={19} strokeWidth={2} />
			</button>
		</div>
	</header>

	{#if menuOpen}
		<button
			class="overlay"
			aria-label="Close menu"
			onclick={() => (menuOpen = false)}
			transition:fade={{ duration: 200 }}
		></button>
	{/if}

	<aside class="sidebar" class:open={menuOpen}>
		<button class="close" onclick={() => (menuOpen = false)} aria-label="Close menu">
			<X size={18} strokeWidth={2} />
		</button>
		{@render sidebar()}
	</aside>

	<main class="content">
		{@render children()}
	</main>
</div>

<FeedbackHost />
<CommandPalette bind:open={searchOpen} />

<style>
	.admin {
		--sidebar-w: 264px;
		--inset: 12px;
		min-height: 100svh;
		display: grid;
		grid-template-columns: calc(var(--sidebar-w) + var(--inset)) minmax(0, 1fr);
		background: var(--bg);
	}

	/* A floating rounded panel, inset from the window edges. */
	.sidebar {
		position: sticky;
		top: var(--inset);
		height: calc(100svh - var(--inset) * 2);
		margin: var(--inset) 0 var(--inset) var(--inset);
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		padding: 1rem 0.75rem 0.75rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-xl);
		background: var(--bg-elevated);
		box-shadow: var(--shadow);
		overflow-y: auto;
		scrollbar-width: none;
	}

	@media (max-width: 959px) {
		.admin {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto 1fr;
		}

		.sidebar {
			position: fixed !important;
			top: var(--inset);
			left: 0;
			bottom: var(--inset);
			z-index: 90;
			height: auto;
			margin: 0;
			width: min(290px, calc(100vw - 2rem));
			transform: translateX(calc(-100% - var(--inset) * 2));
			visibility: hidden;
			box-shadow: var(--shadow-lg);
			transition:
				transform 0.3s var(--ease),
				visibility 0s linear 0.3s;
		}

		.sidebar.open {
			transform: translateX(var(--inset));
			visibility: visible;
			transition: transform 0.3s var(--ease);
		}
	}

	@media (min-width: 960px) {
		.mobile-bar,
		.overlay,
		.close {
			display: none !important;
		}
	}

	.overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		border: 0;
		background: color-mix(in srgb, var(--bg) 40%, rgba(0, 0, 0, 0.35));
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
	}

	.close {
		position: absolute;
		top: 1.1rem;
		right: 0.9rem;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 50%;
		background: var(--surface);
		cursor: pointer;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.25rem 0.4rem;
		padding-right: 2.75rem;
	}

	@media (min-width: 960px) {
		.brand {
			padding-right: 0.4rem;
		}
	}

	.mark {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 13px;
		background: var(--ink);
		color: var(--bg);
		font-weight: 800;
		font-size: 1.05rem;
	}

	.brand-text {
		display: grid;
		min-width: 0;
	}

	.brand-title {
		font-weight: 700;
		font-size: 0.95rem;
		letter-spacing: -0.015em;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.brand-sub {
		font-size: 0.76rem;
		font-weight: 500;
		color: var(--text-subtle);
	}

	.search {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		min-height: 42px;
		padding: 0 0.5rem 0 0.9rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-pill);
		background: var(--bg);
		color: var(--text-subtle);
		font-size: 0.88rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			border-color var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}

	.search:hover {
		border-color: var(--border-strong);
		color: var(--text);
	}

	.search kbd {
		margin-left: auto;
		padding: 0.15rem 0.5rem;
		border-radius: var(--radius-pill);
		background: var(--surface);
		font-family: var(--font-sans);
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	nav {
		display: grid;
		gap: 2px;
	}

	.nav-heading {
		padding: 0.25rem 0.9rem 0.4rem;
		font-size: 0.74rem;
		font-weight: 600;
		color: var(--text-subtle);
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		min-height: 42px;
		padding: 0 0.9rem 0 0.4rem;
		border: 0;
		border-radius: var(--radius-pill);
		background: none;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color var(--dur) var(--ease),
			color var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}

	.nav-icon {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		transition: background-color var(--dur) var(--ease);
	}

	.nav-link:hover {
		background: var(--surface);
		color: var(--text);
	}

	.nav-link.active {
		background: var(--ink);
		color: var(--bg);
		box-shadow: var(--shadow-sm);
	}

	.nav-link.active .nav-icon {
		background: color-mix(in srgb, var(--bg) 16%, transparent);
	}

	.foot {
		display: grid;
		gap: 2px;
		margin-top: auto;
		padding-top: 0.6rem;
		border-top: 1px solid var(--edge);
	}

	.mobile-bar {
		position: sticky;
		top: 0;
		z-index: 40;
		padding: 8px 8px 0;
	}

	.mobile-inner {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		height: 56px;
		padding: 0 0.4rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-pill);
		background: var(--header-bg);
		backdrop-filter: blur(18px) saturate(1.4);
		-webkit-backdrop-filter: blur(18px) saturate(1.4);
		box-shadow: var(--shadow-sm);
	}

	.mobile-inner .brand-title {
		min-width: 0;
	}

	.menu-button {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		background: var(--surface);
		cursor: pointer;
	}

	.search-button {
		margin-left: auto;
	}

	.content {
		min-width: 0;
		padding: clamp(1.25rem, 3.5vw, 2.5rem) clamp(1rem, 3.5vw, 2.75rem) 5rem;
	}
</style>
