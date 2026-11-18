<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import House from '@lucide/svelte/icons/house';
	import Search from '@lucide/svelte/icons/search';
	import LogOut from '@lucide/svelte/icons/log-out';
	import FeedbackHost from '#lib/components/admin/FeedbackHost.svelte';
	import CommandPalette from '#lib/components/admin/CommandPalette.svelte';
	import '#lib/components/admin/admin-ui.css';
	import { indexNumber } from './format.js';
	import type { LayoutProps } from '../../../routes/admin/(app)/$types';

	let { children, data }: LayoutProps = $props();
	let searchOpen = $state(false);
	let shortcut = $state('Ctrl K');
	onMount(() => {
		if (/Mac|iPhone|iPad/.test(navigator.userAgent)) shortcut = '⌘K';
	});

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

	/** Keep the current tab in view when the tab row scrolls (phones). */
	function revealActive(node: HTMLElement) {
		void page.url.pathname;
		const current = node.querySelector<HTMLElement>('[aria-current="page"]');
		if (current && node.scrollWidth > node.clientWidth) {
			node.scrollLeft = current.offsetLeft - node.clientWidth / 2 + current.offsetWidth / 2;
		}
	}
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="admin">
	<header class="bar">
		<div class="top">
			<a class="brand" href="/admin">
				<span class="tag">Admin</span>
				<span class="brand-title">{data.settings.siteTitle}</span>
			</a>
			<div class="tools">
				<button class="tool search" onclick={() => (searchOpen = true)}>
					<Search size={15} strokeWidth={1.5} />
					<span class="search-label">Search</span>
					<kbd>{shortcut}</kbd>
				</button>
				<a class="tool" href="/" target="_blank" rel="noopener" title="Public homepage">
					<House size={16} strokeWidth={1.5} />
					<span class="visually-hidden">Public homepage</span>
				</a>
				<form method="POST" action="/admin/logout">
					<button class="tool" title="Sign out">
						<LogOut size={16} strokeWidth={1.5} />
						<span class="visually-hidden">Sign out</span>
					</button>
				</form>
			</div>
		</div>
		<nav class="tabs" aria-label="Admin" {@attach revealActive}>
			{#each links as link, i (link.href)}
				<a
					class="tab"
					href={link.href}
					aria-current={active(link.href, link.exact) ? 'page' : undefined}
				>
					<span class="no">{indexNumber(i + 1)}</span>{link.label}
				</a>
			{/each}
		</nav>
	</header>

	<main class="content">
		{@render children()}
	</main>
</div>

<FeedbackHost />
<CommandPalette bind:open={searchOpen} />

<style>
	.admin {
		min-height: 100svh;
	}

	.bar {
		position: sticky;
		top: 0;
		z-index: 60;
		background: var(--bg);
		border-bottom: var(--rule);
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		height: var(--admin-brand-h);
		padding-inline: var(--gutter);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		min-width: 0;
		text-decoration: none;
	}

	.tag {
		flex: none;
		padding: 0.1rem 0.4rem;
		background: var(--ink);
		color: var(--bg);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		text-transform: uppercase;
	}

	.brand-title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 1rem;
		font-weight: 650;
		letter-spacing: -0.025em;
	}

	.tools {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex: none;
	}

	.tools form {
		display: contents;
	}

	.tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-width: 36px;
		height: 36px;
		padding: 0;
		border: 1px solid transparent;
		background: none;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		text-decoration: none;
		cursor: pointer;
		transition:
			background-color var(--fast) var(--ease),
			color var(--fast) var(--ease),
			border-color var(--fast) var(--ease);
	}

	.tool:hover {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--bg);
	}

	.search {
		padding: 0 0.6rem;
		margin-right: 0.35rem;
		border-color: var(--border-strong);
	}

	kbd {
		margin-left: 1.25rem;
		padding: 0 0.3rem;
		border: 1px solid currentColor;
		font-size: 0.62rem;
		opacity: 0.7;
	}

	@media (max-width: 640px) {
		.search {
			padding: 0;
			margin-right: 0;
			border-color: transparent;
		}

		.search-label,
		kbd {
			display: none;
		}
	}

	.tabs {
		display: flex;
		height: var(--admin-tabs-h);
		padding-inline: var(--gutter);
		border-top: 1px solid var(--border);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: none;
		padding: 0 0.85rem;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--text-muted);
		transition:
			background-color var(--fast) var(--ease),
			color var(--fast) var(--ease);
	}

	.tab:first-child {
		margin-left: -0.85rem;
	}

	.no {
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.tab:hover {
		background: var(--surface);
		color: var(--text);
	}

	.tab[aria-current='page'] {
		background: var(--ink);
		color: var(--bg);
	}

	.tab[aria-current='page'] .no {
		color: inherit;
		opacity: 0.6;
	}

	.content {
		max-width: var(--max-width);
		margin: 0 auto;
		padding: clamp(1.25rem, 3vw, 2.5rem) var(--gutter) 5rem;
		counter-reset: section;
	}
</style>
