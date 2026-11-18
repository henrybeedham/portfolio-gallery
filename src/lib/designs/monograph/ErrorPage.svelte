<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Not found' : 'Something went wrong'}</title>
</svelte:head>

<main class="error-page">
	<span class="numeral">{page.status}</span>
	<p class="eyebrow">An error</p>
	<h1>{page.status === 404 ? 'This page could not be found' : 'Something went wrong'}</h1>
	<p class="muted">
		{page.status === 404
			? 'The gallery or photo you were looking for may have moved or is no longer available.'
			: page.error?.message}
	</p>
	<div class="ornament" aria-hidden="true"></div>
	<a class="btn" href="/">Return Home</a>
</main>

<style>
	.error-page {
		min-height: 100vh;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 1.25rem;
		padding: var(--gutter);
		text-align: center;
	}

	h1 {
		font-size: clamp(2.2rem, 6vw, 3.8rem);
		font-weight: 400;
		max-width: 18ch;
	}

	.numeral {
		font-size: 1.4rem;
	}

	p.muted {
		max-width: 40ch;
		font-style: italic;
		font-size: 1.1rem;
	}
</style>
