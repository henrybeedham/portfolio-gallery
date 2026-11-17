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
	import type { LayoutProps } from './$types';

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

{#snippet sidebar()}
	<div class="brand">
		<span class="eyebrow">Admin</span>
		<span class="brand-title">{data.settings.siteTitle}</span>
	</div>
	<nav>
		<a class="nav-link" href="/" target="_blank" rel="noopener">
			<House size={16} strokeWidth={1.5} /> Public homepage
		</a>
		<button class="nav-link search" onclick={openSearch}>
			<Search size={16} strokeWidth={1.5} /> Search <kbd>{shortcut}</kbd>
		</button>
		<div class="divider"></div>
		{#each links as link (link.href)}
			<a class="nav-link" class:active={active(link.href, link.exact)} href={link.href}>
				<link.icon size={16} strokeWidth={1.5} />
				{link.label}
			</a>
		{/each}
	</nav>
	<form method="POST" action="/admin/logout" class="logout">
		<button class="nav-link"><LogOut size={16} strokeWidth={1.5} /> Logout</button>
	</form>
{/snippet}

<div class="admin">
	<header class="mobile-bar">
		<button class="menu-button" onclick={() => (menuOpen = true)} aria-label="Open menu">
			<Menu size={20} strokeWidth={1.5} />
		</button>
		<span class="brand-title">{data.settings.siteTitle}</span>
		<button class="menu-button search-button" onclick={openSearch} aria-label="Search">
			<Search size={19} strokeWidth={1.5} />
		</button>
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
			<X size={18} strokeWidth={1.5} />
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
		min-height: 100svh;
		display: grid;
		grid-template-columns: 260px minmax(0, 1fr);
	}

	@media (max-width: 959px) {
		.admin {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto 1fr;
		}

		.sidebar {
			position: fixed !important;
			left: 0;
			bottom: 0;
			z-index: 90;
			width: min(280px, 85vw);
			transform: translateX(-100%);
			visibility: hidden;
			transition:
				transform 0.3s var(--ease),
				visibility 0s linear 0.3s;
		}

		.sidebar.open {
			transform: none;
			visibility: visible;
			box-shadow: 20px 0 60px rgba(0, 0, 0, 0.15);
			transition: transform 0.3s var(--ease);
		}
	}

	@media (min-width: 960px) {
		/* Paint the sidebar column full-height even when the page is taller than the viewport. */
		.admin {
			background: linear-gradient(
				to right,
				var(--bg-elevated) 259px,
				var(--border) 259px 260px,
				var(--bg) 260px
			);
		}

		.mobile-bar,
		.overlay,
		.close {
			display: none !important;
		}
	}

	.sidebar {
		position: sticky;
		top: 0;
		height: 100svh;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding: 2rem 1.25rem 1.5rem;
		border-right: 1px solid var(--border);
		background: var(--bg-elevated);
	}

	.overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		border: 0;
		background: rgba(20, 18, 15, 0.4);
		backdrop-filter: blur(2px);
	}

	.close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.brand {
		display: grid;
		gap: 0.4rem;
		padding: 0 0.75rem;
	}

	.brand-title {
		font-family: var(--font-serif);
		font-size: 1.2rem;
		line-height: 1.25;
	}

	nav {
		display: grid;
		gap: 0.15rem;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.7rem 0.75rem;
		border: 0;
		border-left: 2px solid transparent;
		background: none;
		color: var(--text-muted);
		font-size: 0.88rem;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color 0.2s var(--ease),
			color 0.2s var(--ease);
	}

	.nav-link:hover {
		background: var(--surface);
		color: var(--text);
	}

	.nav-link.active {
		background: var(--surface);
		color: var(--text);
		border-left-color: var(--text);
	}

	.search kbd {
		margin-left: auto;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--border-strong);
		font-family: var(--font-sans);
		font-size: 0.64rem;
		letter-spacing: 0.06em;
		color: var(--text-subtle);
	}

	.search-button {
		margin-left: auto;
	}

	.divider {
		height: 1px;
		margin: 0.6rem 0.75rem;
		background: var(--border);
	}

	.logout {
		margin-top: auto;
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	.mobile-bar {
		position: sticky;
		top: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 60px;
		padding: 0 0.75rem;
		border-bottom: 1px solid var(--border);
		background: var(--header-bg);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
	}

	.menu-button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.content {
		min-width: 0;
		padding: clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 3rem) 5rem;
	}
</style>
