<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';

	interface Props {
		title: string;
		/** `overlay` sits over the top of the home page without a rule until scrolled. */
		mode?: 'overlay' | 'sticky';
	}

	let { title, mode = 'sticky' }: Props = $props();

	let scrollY = $state(0);
	let open = $state(false);
	const ruled = $derived(mode === 'sticky' || scrollY > 8 || open);

	const links = [
		{ href: '/#work', label: 'Work' },
		{ href: '/galleries', label: 'Galleries' },
		{ href: '/#about', label: 'About' }
	];

	function current(href: string) {
		return href === page.url.pathname;
	}
</script>

<svelte:window bind:scrollY />

<header class="header" class:ruled>
	<div class="inner container">
		<a class="title" href="/" onclick={() => (open = false)}>{title}</a>
		<nav aria-label="Main">
			<ol class="links">
				{#each links as link, i (link.href)}
					<li>
						<a href={link.href} aria-current={current(link.href) ? 'page' : undefined}>
							<span class="no">{String(i + 1).padStart(2, '0')}</span>{link.label}
						</a>
					</li>
				{/each}
			</ol>
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
		<ol class="mobile-links" transition:fade={{ duration: 150 }}>
			{#each links as link, i (link.href)}
				<li>
					<a href={link.href} onclick={() => (open = false)}>
						<span class="no">{String(i + 1).padStart(2, '0')}</span>{link.label}
					</a>
				</li>
			{/each}
		</ol>
	{/if}
</header>

<style>
	.header {
		position: sticky;
		top: 0;
		z-index: 50;
		background: var(--bg);
		border-bottom: 1px solid transparent;
		transition: border-color var(--base) var(--ease);
	}

	.header.ruled {
		border-bottom-color: var(--text);
	}

	.inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		height: var(--header-height);
	}

	.title {
		min-width: 0;
		font-size: 1.05rem;
		font-weight: 650;
		letter-spacing: -0.025em;
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.links {
		display: flex;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.links a,
	.mobile-links a {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--text);
	}

	.links a {
		padding: 0.45rem 0.7rem;
		transition:
			background-color var(--fast) var(--ease),
			color var(--fast) var(--ease);
	}

	.links a:hover,
	.links a[aria-current='page'] {
		background: var(--ink);
		color: var(--bg);
	}

	.no {
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
		transition: color var(--fast) var(--ease);
	}

	.links a:hover .no,
	.links a[aria-current='page'] .no {
		color: inherit;
		opacity: 0.6;
	}

	.toggle {
		display: none;
		width: 44px;
		height: 44px;
		margin-right: -10px;
		place-items: center;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.mobile-links {
		display: none;
		list-style: none;
		margin: 0;
		padding: 0 var(--gutter) 1rem;
	}

	.mobile-links li {
		border-top: 1px solid var(--border);
	}

	.mobile-links a {
		padding: 1rem 0;
		font-size: 0.85rem;
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
