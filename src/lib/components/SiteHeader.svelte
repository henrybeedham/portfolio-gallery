<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { fade } from 'svelte/transition';

	interface Props {
		title: string;
		/** `overlay` starts transparent over the hero and gains a background once scrolled. */
		mode?: 'overlay' | 'sticky';
		/** Signed in as the admin: adds a link to the dashboard. */
		isAdmin?: boolean;
	}

	let { title, mode = 'sticky', isAdmin = false }: Props = $props();

	let scrollY = $state(0);
	let open = $state(false);
	const solid = $derived(mode === 'sticky' || scrollY > 40 || open);

	const links = [
		{ href: '/#work', label: 'Work' },
		{ href: '/#about', label: 'About' }
	];
</script>

<svelte:window bind:scrollY />

<header class="header {mode}" class:solid>
	<div class="inner container">
		<a class="title" href="/" onclick={() => (open = false)}>{title}</a>
		<nav aria-label="Main">
			<ul class="links">
				{#each links as link (link.href)}
					<li><a href={link.href}>{link.label}</a></li>
				{/each}
				{#if isAdmin}
					<li><a class="dashboard" href="/admin">Dashboard</a></li>
				{/if}
			</ul>
			<button
				class="toggle"
				onclick={() => (open = !open)}
				aria-expanded={open}
				aria-label={open ? 'Close menu' : 'Open menu'}
			>
				{#if open}<X size={20} strokeWidth={1.5} />{:else}<Menu size={20} strokeWidth={1.5} />{/if}
			</button>
		</nav>
	</div>
	{#if open}
		<ul class="mobile-links" transition:fade={{ duration: 180 }}>
			{#each links as link (link.href)}
				<li><a href={link.href} onclick={() => (open = false)}>{link.label}</a></li>
			{/each}
			{#if isAdmin}
				<li><a href="/admin">Dashboard</a></li>
			{/if}
		</ul>
	{/if}
</header>

<style>
	.header {
		top: 0;
		left: 0;
		right: 0;
		z-index: 50;
		border-bottom: 1px solid transparent;
		transition:
			background-color 0.45s var(--ease),
			border-color 0.45s var(--ease),
			backdrop-filter 0.45s var(--ease);
	}

	.header.overlay {
		position: fixed;
	}

	.header.sticky {
		position: sticky;
	}

	.header.solid {
		background: var(--header-bg);
		border-bottom-color: color-mix(in srgb, var(--border) 70%, transparent);
		backdrop-filter: blur(16px) saturate(1.2);
		-webkit-backdrop-filter: blur(16px) saturate(1.2);
	}

	.inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		height: var(--header-height);
	}

	.title {
		font-family: var(--font-serif);
		font-size: clamp(1.05rem, 2vw, 1.3rem);
		text-decoration: none;
		letter-spacing: 0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.links {
		display: flex;
		align-items: center;
		gap: clamp(1.25rem, 3vw, 2.75rem);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.links a,
	.mobile-links a {
		position: relative;
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--text);
	}

	.links a::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -6px;
		height: 1px;
		background: currentColor;
		transform: scaleX(0);
		transform-origin: right;
		transition: transform 0.35s var(--ease);
	}

	.links a:hover::after {
		transform: scaleX(1);
		transform-origin: left;
	}

	.links a.dashboard {
		padding: 0.55rem 0.9rem;
		border: 1px solid var(--border-strong);
		transition: border-color 0.35s var(--ease);
	}

	.links a.dashboard::after {
		display: none;
	}

	.links a.dashboard:hover {
		border-color: var(--text);
	}

	.toggle {
		display: none;
		width: 40px;
		height: 40px;
		place-items: center;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.mobile-links {
		display: none;
		list-style: none;
		margin: 0;
		padding: 0.5rem var(--gutter) 1.5rem;
	}

	.mobile-links li {
		border-top: 1px solid var(--border);
	}

	.mobile-links a {
		display: block;
		padding: 1rem 0;
	}

	@media (max-width: 640px) {
		.links {
			display: none;
		}

		.toggle {
			display: grid;
		}

		.mobile-links {
			display: block;
		}
	}
</style>
