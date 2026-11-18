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

	const monogram = $derived(data.settings.siteTitle.trim().charAt(0) || 'G');

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
	<a class="brand" href="/admin" aria-label="{data.settings.siteTitle} admin">
		<span class="mark" aria-hidden="true">{monogram}</span>
		<span class="label brand-text">
			<span class="brand-title">{data.settings.siteTitle}</span>
			<span class="brand-sub">Admin</span>
		</span>
	</a>
	<nav aria-label="Admin">
		<button class="nav-link search" onclick={openSearch}>
			<Search size={18} strokeWidth={1.5} />
			<span class="label">Search</span>
			<kbd class="label">{shortcut}</kbd>
		</button>
		<span class="divider" aria-hidden="true"></span>
		{#each links as link (link.href)}
			{@const isActive = active(link.href, link.exact)}
			<a
				class="nav-link"
				class:active={isActive}
				href={link.href}
				aria-current={isActive ? 'page' : undefined}
				title={link.label}
			>
				<link.icon size={18} strokeWidth={1.5} />
				<span class="label">{link.label}</span>
			</a>
		{/each}
	</nav>
	<div class="foot">
		<a class="nav-link" href="/" target="_blank" rel="noopener" title="Public homepage">
			<House size={18} strokeWidth={1.5} />
			<span class="label">Public Homepage</span>
		</a>
		<form method="POST" action="/admin/logout">
			<button class="nav-link" title="Log out">
				<LogOut size={18} strokeWidth={1.5} />
				<span class="label">Log Out</span>
			</button>
		</form>
	</div>
{/snippet}

<div class="admin">
	<header class="mobile-bar">
		<button class="menu-button" onclick={() => (menuOpen = true)} aria-label="Open menu">
			<Menu size={20} strokeWidth={1.5} />
		</button>
		<span class="mobile-title">{data.settings.siteTitle}</span>
		<button class="menu-button" onclick={openSearch} aria-label="Search">
			<Search size={19} strokeWidth={1.5} />
		</button>
	</header>

	{#if menuOpen}
		<button
			class="overlay"
			aria-label="Close menu"
			onclick={() => (menuOpen = false)}
			transition:fade={{ duration: 250 }}
		></button>
	{/if}

	<aside class="rail" class:open={menuOpen}>
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
		--rail: 76px;
		--rail-open: 248px;
		min-height: 100svh;
	}

	/* ---------------------------------------------------------------- rail */

	/*
	 * A narrow icon rail that widens over the content on hover or keyboard focus, so labels are a
	 * glance away without the page reflowing. On phones it becomes a drawer with labels showing.
	 */
	.rail {
		position: fixed;
		top: 0;
		left: 0;
		bottom: 0;
		z-index: 90;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: var(--rail);
		padding: 1rem 0.75rem;
		overflow: hidden;
		background: var(--bg-elevated);
		border-right: 1px solid var(--border);
		transition:
			width 0.45s var(--ease-slow),
			box-shadow 0.45s var(--ease);
	}

	@media (min-width: 960px) {
		.content {
			margin-left: var(--rail);
		}

		.rail:hover,
		.rail:focus-within {
			width: var(--rail-open);
			box-shadow: var(--shadow-float);
		}

		.rail .label {
			opacity: 0;
			transition: opacity 0.3s var(--ease);
		}

		.rail:hover .label,
		.rail:focus-within .label {
			opacity: 1;
			transition-delay: 0.08s;
		}

		.mobile-bar,
		.overlay,
		.close {
			display: none !important;
		}
	}

	@media (max-width: 959px) {
		.rail {
			width: min(280px, 85vw);
			padding: 1rem;
			transform: translateX(-100%);
			visibility: hidden;
			transition:
				transform 0.4s var(--ease-slow),
				visibility 0s linear 0.4s;
		}

		.rail.open {
			transform: none;
			visibility: visible;
			box-shadow: var(--shadow-float);
			transition: transform 0.4s var(--ease-slow);
		}
	}

	.overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		border: 0;
		background: color-mix(in srgb, var(--lightbox-bg) 45%, transparent);
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
	}

	.close {
		position: absolute;
		top: 1.1rem;
		right: 0.85rem;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		min-height: 52px;
		text-decoration: none;
	}

	.mark {
		display: grid;
		place-items: center;
		flex: none;
		width: 52px;
		height: 52px;
		border-radius: var(--radius);
		background: var(--emphasis);
		color: var(--bg);
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 500;
		line-height: 1;
		text-transform: uppercase;
	}

	.brand-text {
		display: grid;
		min-width: 0;
		line-height: 1.15;
	}

	.brand-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 500;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.brand-sub {
		font-size: 0.75rem;
		color: var(--text-subtle);
	}

	nav {
		display: grid;
		gap: 0.2rem;
	}

	.nav-link {
		position: relative;
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		min-height: 44px;
		padding: 0 0.95rem;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 0.25s var(--ease),
			color 0.25s var(--ease);
	}

	.nav-link :global(svg) {
		flex: none;
	}

	.nav-link:hover {
		background: color-mix(in srgb, var(--text) 6%, transparent);
		color: var(--text);
	}

	.nav-link.active {
		background: color-mix(in srgb, var(--emphasis) 14%, transparent);
		color: var(--text);
	}

	.nav-link.active::before {
		content: '';
		position: absolute;
		left: -0.75rem;
		top: 10px;
		bottom: 10px;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: var(--emphasis);
	}

	.search kbd {
		margin-left: auto;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		font-family: var(--font-sans);
		font-size: 0.68rem;
		color: var(--text-subtle);
	}

	.divider {
		height: 1px;
		margin: 0.5rem 0.6rem;
		background: var(--border);
	}

	.foot {
		display: grid;
		gap: 0.2rem;
		margin-top: auto;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.mobile-bar {
		position: sticky;
		top: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 60px;
		padding: 0 0.5rem;
		border-bottom: 1px solid var(--border);
		background: var(--header-bg);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}

	.mobile-title {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 500;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.menu-button {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}

	.content {
		min-width: 0;
		padding: clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 3.5rem) 5rem;
	}
</style>
