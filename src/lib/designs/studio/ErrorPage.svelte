<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Not found' : 'Something went wrong'}</title>
</svelte:head>

<main class="error-page">
	<span class="code" aria-hidden="true">{page.status}</span>
	<span class="kicker">Error {page.status}</span>
	<h1>{page.status === 404 ? 'This page could not be found' : 'Something went wrong'}</h1>
	<p class="muted">
		{page.status === 404
			? 'The gallery or photo you were looking for may have moved or is no longer available.'
			: page.error?.message}
	</p>
	<a class="btn btn-solid" href="/">Return Home</a>
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

	.code {
		font-size: clamp(5rem, 18vw, 9rem);
		font-weight: 800;
		letter-spacing: -0.06em;
		line-height: 0.9;
		color: color-mix(in srgb, var(--ink) 18%, transparent);
	}

	h1 {
		font-size: clamp(1.8rem, 5vw, 2.8rem);
		font-weight: 800;
		letter-spacing: -0.035em;
		max-width: 18ch;
	}

	p.muted {
		max-width: 46ch;
	}
</style>
