<script lang="ts">
	import '@fontsource-variable/playfair-display';
	import '@fontsource-variable/playfair-display/wght-italic.css';
	import '@fontsource-variable/inter';
	import '../app.css';
	import { navigating, page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// The site theme, or an album's own theme on its pages.
	const theme = $derived(page.data.theme ?? data.theme);

	$effect(() => {
		document.documentElement.dataset.theme = theme.id;
	});

	// Themes uploaded or deleted since this page loaded: swap in the new CSS without a reload.
	$effect(() => {
		const version = data.theme.version;
		const style = document.getElementById('themes');
		if (!style || style.dataset.version === version) return;
		fetch(`/site/themes.css?v=${version}`)
			.then((response) => (response.ok ? response.text() : Promise.reject()))
			.then((css) => {
				style.textContent = css;
				style.dataset.version = version;
			})
			.catch(() => {});
	});
</script>

<svelte:head>
	<meta name="theme-color" content={theme.color} />
	<link rel="icon" href={theme.icons.favicon} type="image/svg+xml" />
	<link rel="apple-touch-icon" href={theme.icons.touch} />
</svelte:head>

{#if navigating.to}
	<div class="nav-progress" aria-hidden="true"></div>
{/if}

{@render children()}

<style>
	.nav-progress {
		position: fixed;
		top: 0;
		left: 0;
		z-index: 200;
		height: 2px;
		width: 100%;
		background: var(--text);
		transform-origin: left;
		animation: progress 1.6s var(--ease) forwards;
		animation-delay: 0.15s;
		transform: scaleX(0);
	}

	@keyframes progress {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(0.85);
		}
	}
</style>
