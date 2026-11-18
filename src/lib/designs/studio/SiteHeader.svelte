<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { page } from '$app/state';

	interface Props {
		title: string;
		/** `overlay` stays airy at the top of the page and firms up once scrolled. */
		mode?: 'overlay' | 'sticky';
	}

	let { title, mode = 'sticky' }: Props = $props();

	let scrollY = $state(0);
	let open = $state(false);
	const raised = $derived(mode === 'sticky' || scrollY > 24 || open);

	const links = [
		{ href: '/#work', label: 'Work' },
		{ href: '/galleries', label: 'Galleries' },
		{ href: '/#about', label: 'About' }
	];

	const initial = $derived(title.trim().charAt(0).toUpperCase() || '·');

	function isActive(href: string) {
		return href === '/galleries' && page.url.pathname.startsWith('/galleries');
	}
</script>

<svelte:window bind:scrollY />

<header class="header" class:raised>
	<div class="container">
		<div class="bar">
			<a class="brand" href="/" onclick={() => (open = false)}>
				<span class="mark" aria-hidden="true">{initial}</span>
				<span class="title">{title}</span>
			</a>
			<nav aria-label="Main">
				<ul class="links">
					{#each links as link (link.href)}
						<li>
							<a
								href={link.href}
								class:active={isActive(link.href)}
								aria-current={isActive(link.href) ? 'page' : undefined}>{link.label}</a
							>
						</li>
					{/each}
				</ul>
				<button
					class="toggle"
					onclick={() => (open = !open)}
					aria-expanded={open}
					aria-label={open ? 'Close menu' : 'Open menu'}
				>
					{#if open}<X size={20} strokeWidth={2} />{:else}<Menu size={20} strokeWidth={2} />{/if}
				</button>
			</nav>
		</div>
		{#if open}
			<ul class="mobile-links" transition:fly={{ y: -8, duration: 220, easing: cubicOut }}>
				{#each links as link (link.href)}
					<li><a href={link.href} onclick={() => (open = false)}>{link.label}</a></li>
				{/each}
			</ul>
		{/if}
	</div>
</header>

<style>
	.header {
		position: sticky;
		top: 0;
		z-index: 50;
		padding-top: 12px;
		pointer-events: none;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		height: 60px;
		padding: 0 0.5rem 0 0.6rem;
		border: 1px solid transparent;
		border-radius: var(--radius-pill);
		pointer-events: auto;
		transition:
			background-color var(--dur) var(--ease),
			border-color var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}

	.raised .bar {
		background: var(--header-bg);
		border-color: var(--edge);
		backdrop-filter: blur(18px) saturate(1.4);
		-webkit-backdrop-filter: blur(18px) saturate(1.4);
		box-shadow: var(--shadow-sm);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		text-decoration: none;
	}

	.mark {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--ink);
		color: var(--bg);
		font-weight: 800;
		font-size: 1rem;
		letter-spacing: -0.02em;
	}

	.title {
		font-weight: 700;
		font-size: 1rem;
		letter-spacing: -0.015em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.links {
		display: flex;
		gap: 0.25rem;
		list-style: none;
		margin: 0;
		padding: 4px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--surface) 70%, transparent);
	}

	.links a {
		display: inline-flex;
		align-items: center;
		min-height: 38px;
		padding: 0 1rem;
		border-radius: var(--radius-pill);
		font-size: 0.9rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--text-muted);
		transition:
			background-color var(--dur) var(--ease),
			color var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}

	.links a:hover {
		color: var(--text);
		background: var(--bg-elevated);
	}

	.links a.active {
		color: var(--text);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-sm);
	}

	.toggle {
		display: none;
		width: 44px;
		height: 44px;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: var(--surface);
		cursor: pointer;
	}

	.mobile-links {
		display: none;
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0.5rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-lg);
		pointer-events: auto;
	}

	.mobile-links a {
		display: block;
		padding: 0.85rem 1rem;
		border-radius: var(--radius);
		font-weight: 600;
		text-decoration: none;
	}

	.mobile-links a:hover {
		background: var(--surface);
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
