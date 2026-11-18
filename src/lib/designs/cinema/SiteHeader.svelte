<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { fade } from 'svelte/transition';

	interface Props {
		title: string;
		/** `overlay` starts transparent over the hero and floats in as a glass pill once scrolled. */
		mode?: 'overlay' | 'sticky';
	}

	let { title, mode = 'sticky' }: Props = $props();

	let scrollY = $state(0);
	let open = $state(false);
	const solid = $derived(mode === 'sticky' || scrollY > 40);

	const links = [
		{ href: '/#work', label: 'Work' },
		{ href: '/galleries', label: 'Galleries' },
		{ href: '/#about', label: 'About' }
	];

	function onkeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') open = false;
	}

	// Lock the page behind the full-screen menu.
	$effect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});
</script>

<svelte:window bind:scrollY {onkeydown} />

<header class="header {mode}" class:solid class:open>
	<div class="bar">
		<a class="title" href="/" onclick={() => (open = false)}>{title}</a>
		<nav aria-label="Main">
			<ul class="links">
				{#each links as link (link.href)}
					<li><a href={link.href}>{link.label}</a></li>
				{/each}
			</ul>
			<button
				class="toggle"
				onclick={() => (open = !open)}
				aria-expanded={open}
				aria-controls="site-menu"
				aria-label={open ? 'Close menu' : 'Open menu'}
			>
				{#if open}<X size={20} strokeWidth={1.5} />{:else}<Menu size={20} strokeWidth={1.5} />{/if}
			</button>
		</nav>
	</div>
</header>

{#if open}
	<div class="menu" id="site-menu" transition:fade={{ duration: 300 }}>
		<ul>
			{#each links as link, i (link.href)}
				<li style:animation-delay="{0.06 + i * 0.07}s">
					<a href={link.href} onclick={() => (open = false)}>{link.label}</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.header {
		top: 0;
		left: 0;
		right: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		height: var(--header-height);
		padding-inline: clamp(0.5rem, 2vw, 1.5rem);
		pointer-events: none;
	}

	.header.overlay {
		position: fixed;
	}

	.header.sticky {
		position: sticky;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		width: 100%;
		max-width: var(--max-width);
		margin-inline: auto;
		height: 52px;
		padding: 0 0.4rem 0 clamp(0.85rem, 2vw, 1.4rem);
		border: 1px solid transparent;
		border-radius: var(--pill);
		pointer-events: auto;
		transition:
			background-color 0.6s var(--ease),
			border-color 0.6s var(--ease),
			box-shadow 0.6s var(--ease),
			backdrop-filter 0.6s var(--ease);
	}

	.solid .bar {
		background: var(--glass);
		border-color: var(--glass-border);
		backdrop-filter: blur(18px) saturate(1.3);
		-webkit-backdrop-filter: blur(18px) saturate(1.3);
	}

	.overlay.solid .bar {
		box-shadow: var(--shadow-float);
	}

	.open .bar {
		background: transparent;
		border-color: transparent;
		box-shadow: none;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
	}

	.title {
		min-width: 0;
		font-family: var(--font-display);
		font-size: clamp(1.1rem, 2vw, 1.35rem);
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	nav {
		display: flex;
		align-items: center;
	}

	.links {
		display: flex;
		gap: 0.25rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.links a {
		display: block;
		padding: 0.5rem 1rem;
		border-radius: var(--pill);
		font-size: 0.86rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--text);
		transition: background-color 0.3s var(--ease);
	}

	.links a:hover {
		background: color-mix(in srgb, var(--text) 9%, transparent);
	}

	.toggle {
		display: none;
		width: 44px;
		height: 44px;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}

	.menu {
		position: fixed;
		inset: 0;
		z-index: 49;
		display: grid;
		align-content: center;
		padding: var(--header-height) var(--gutter) 3rem;
		background: color-mix(in srgb, var(--bg) 96%, transparent);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}

	.menu ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.25rem;
	}

	.menu li {
		animation: cinema-fade-up 0.8s var(--ease-slow) both;
	}

	.menu a {
		display: block;
		padding-block: 0.35rem;
		font-family: var(--font-display);
		font-size: clamp(3rem, 16vw, 5rem);
		font-weight: 500;
		line-height: 1;
		text-transform: uppercase;
		text-decoration: none;
	}

	.menu a:hover {
		color: var(--emphasis);
	}

	@media (max-width: 640px) {
		.links {
			display: none;
		}

		.toggle {
			display: grid;
		}
	}

	@media (min-width: 641px) {
		.menu {
			display: none;
		}
	}
</style>
