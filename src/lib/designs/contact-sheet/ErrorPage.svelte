<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Not found' : 'Something went wrong'}</title>
</svelte:head>

<main class="error-page">
	<span class="frame" aria-hidden="true">{page.status}</span>
	<p class="eyebrow">Error {page.status} · Frame not found</p>
	<h1>{page.status === 404 ? 'This page could not be found' : 'Something went wrong'}</h1>
	<p class="muted">
		{page.status === 404
			? 'The gallery or photo you were looking for may have moved or is no longer available.'
			: page.error?.message}
	</p>
	<a class="btn" href="/">Return Home</a>
</main>

<style>
	.error-page {
		min-height: 100svh;
		display: grid;
		place-content: center;
		justify-items: start;
		gap: 1.1rem;
		width: min(100%, 720px);
		margin: 0 auto;
		padding: var(--gutter);
	}

	.frame {
		display: block;
		width: 100%;
		padding: 0.5rem 0 0.25rem;
		border-block: var(--rule) solid var(--text);
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-weight: 300;
		font-size: clamp(5rem, 22vw, 11rem);
		line-height: 0.85;
		color: var(--text-subtle);
	}

	h1 {
		font-size: clamp(2rem, 5vw, 3.25rem);
		max-width: 20ch;
	}

	p.muted {
		max-width: 52ch;
		font-family: var(--font-sans);
	}
</style>
