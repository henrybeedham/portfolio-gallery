<script lang="ts">
	import '@fontsource-variable/playfair-display';
	import '@fontsource-variable/playfair-display/wght-italic.css';
	import '@fontsource-variable/inter';
	import '../app.css';
	import { navigating } from '$app/state';
	import { THEME_COLORS } from '#lib/types.js';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	$effect(() => {
		document.documentElement.dataset.theme = data.settings.theme;
	});
</script>

<svelte:head>
	<meta name="theme-color" content={THEME_COLORS[data.settings.theme] ?? THEME_COLORS.light} />
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
