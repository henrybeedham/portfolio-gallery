<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { fade } from 'svelte/transition';

	interface Props {
		title: string;
		/** `overlay` starts transparent over the hero and gains a background once scrolled. */
		mode?: 'overlay' | 'sticky';
	}

	let { title, mode = 'sticky' }: Props = $props();

	let scrollY = $state(0);
	let open = $state(false);
	const solid = $derived(mode === 'sticky' || scrollY > 40 || open);

	const links = [
		{ href: '/#work', label: 'Work' },
		{ href: '/galleries', label: 'Galleries' },
		{ href: '/#about', label: 'About' }
	];
</script>

<svelte:window bind:scrollY />

<header class="header {mode}" class:solid>
	<div class="inner container">
		<a class="title" href="/" onclick={() => (open = false)}>
			<span class="reg-mark" aria-hidden="true"></span>
			<span class="title-text">{title}</span>
		</a>
		<nav aria-label="Main">
			<ul class="links">
				{#each links as link, i (link.href)}
					<li>
						<a href={link.href}><span class="no" aria-hidden="true">0{i + 1}</span>{link.label}</a>
					</li>
				{/each}
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
		<ul class="mobile-links" transition:fade={{ duration: 120 }}>
			{#each links as link, i (link.href)}
				<li>
					<a href={link.href} onclick={() => (open = false)}
						><span class="no" aria-hidden="true">0{i + 1}</span>{link.label}</a
					>
				</li>
			{/each}
		</ul>
	{/if}
</header>

<style>
	.header {
		top: 0;
		left: 0;
		right: 0;
		z-index: 50;
		border-bottom: var(--rule) solid transparent;
		transition:
			background-color var(--slow) linear,
			border-color var(--slow) linear;
	}

	.header.overlay {
		position: fixed;
	}

	.header.sticky {
		position: sticky;
	}

	.header.solid {
		background: var(--bg);
		border-bottom-color: var(--rule-color);
	}

	.inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		height: var(--header-height);
	}

	.title {
		display: inline-flex;
		align-items: center;
		gap: 0.7rem;
		min-width: 0;
		text-decoration: none;
	}

	.title-text {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 600;
		font-size: clamp(1.15rem, 2.2vw, 1.45rem);
		line-height: 1;
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.title:hover .reg-mark {
		--m: var(--text);
	}

	.links {
		display: flex;
		gap: clamp(1rem, 2.5vw, 2.25rem);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.links a,
	.mobile-links a {
		display: inline-flex;
		align-items: baseline;
		gap: 0.45rem;
		font-size: 0.74rem;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--text);
	}

	.no {
		font-size: 0.62rem;
		color: var(--text-subtle);
	}

	.links a:hover {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 6px;
	}

	.links a:hover .no {
		color: var(--highlight, var(--text));
	}

	.toggle {
		display: none;
		width: 44px;
		height: 44px;
		place-items: center;
		border: 1px solid var(--border-strong);
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
		display: flex;
		padding: 0.95rem 0;
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
