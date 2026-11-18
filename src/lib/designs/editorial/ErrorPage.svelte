<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Not found' : 'Something went wrong'}</title>
</svelte:head>

<main class="error-page">
	<p class="eyebrow">Error {page.status}</p>
	<h1>{page.status === 404 ? 'This page could not be found' : 'Something went wrong'}</h1>
	<p class="muted">
		{page.status === 404
			? 'The gallery or photo you were looking for may have moved or is no longer available.'
			: page.error?.message}
	</p>
	<a class="btn" href="/">Return home</a>
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
		font-size: clamp(2rem, 5vw, 3.25rem);
		max-width: 18ch;
	}

	p.muted {
		max-width: 46ch;
	}
</style>
