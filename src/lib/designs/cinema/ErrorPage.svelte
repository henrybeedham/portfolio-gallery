<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Not found' : 'Something went wrong'}</title>
</svelte:head>

<main class="error-page">
	<span class="status" aria-hidden="true">{page.status}</span>
	<div class="content">
		<p class="eyebrow fade-up">Error {page.status}</p>
		<h1 class="fade-up" style:animation-delay="0.1s">
			{page.status === 404 ? 'This page could not be found' : 'Something went wrong'}
		</h1>
		<p class="muted fade-up" style:animation-delay="0.2s">
			{page.status === 404
				? 'The gallery or photo you were looking for may have moved or is no longer available.'
				: page.error?.message}
		</p>
		<a class="btn btn-solid fade-up" style:animation-delay="0.3s" href="/">Return Home</a>
	</div>
</main>

<style>
	.error-page {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 100svh;
		padding: var(--gutter);
		overflow: hidden;
		isolation: isolate;
		text-align: center;
	}

	/* The status code, set enormous behind the message like a title card. */
	.status {
		position: absolute;
		inset: 0;
		z-index: -1;
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-size: clamp(12rem, 48vw, 40rem);
		font-weight: 600;
		line-height: 1;
		color: color-mix(in srgb, var(--text) 5%, transparent);
		user-select: none;
		animation: cinema-fade-in 2s var(--ease) both;
	}

	.content {
		display: grid;
		justify-items: center;
		gap: 1.25rem;
	}

	h1 {
		font-size: clamp(2.6rem, 7vw, 5.5rem);
		line-height: 0.9;
		max-width: 14ch;
	}

	p.muted {
		max-width: 46ch;
	}
</style>
