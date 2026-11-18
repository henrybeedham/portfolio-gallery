<script lang="ts">
	import { enhance } from '$app/forms';
	import Lock from '@lucide/svelte/icons/lock';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	interface Props {
		title: string;
		siteTitle: string;
		error?: string | null;
		next?: string;
	}

	let { title, siteTitle, error = null, next = '' }: Props = $props();
	let submitting = $state(false);
</script>

<main class="gate">
	<a class="link back" href="/"><ArrowLeft size={14} /> {siteTitle}</a>
	<div class="card fade-up">
		<span class="icon"><Lock size={18} strokeWidth={1.5} /></span>
		<p class="eyebrow">Private gallery</p>
		<h1>{title}</h1>
		<p class="muted">
			This gallery is password protected. Please enter the password you were given to view and
			download the photos.
		</p>
		<form
			method="POST"
			action="?/unlock"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<input type="hidden" name="next" value={next} />
			<label class="visually-hidden" for="gallery-password">Password</label>
			<input
				id="gallery-password"
				class="input"
				type="password"
				name="password"
				placeholder="Password"
				autocomplete="current-password"
				required
			/>
			<button class="btn btn-accent" disabled={submitting}>
				{#if submitting}<span class="spinner"></span>{/if}
				View Gallery
			</button>
		</form>
		{#if error}
			<p class="alert alert-error" role="alert">{error}</p>
		{/if}
	</div>
</main>

<style>
	.gate {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: 5rem var(--gutter) 3rem;
		position: relative;
	}

	.back {
		position: absolute;
		top: 1.75rem;
		left: var(--gutter);
	}

	.card {
		display: grid;
		justify-items: center;
		gap: 1rem;
		width: min(100%, 460px);
		padding: clamp(2rem, 5vw, 3rem);
		border: 1px solid var(--border);
		background: var(--bg-elevated);
		text-align: center;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border: 1px solid var(--border-strong);
		margin-bottom: 0.5rem;
	}

	h1 {
		font-size: clamp(1.9rem, 5vw, 2.6rem);
	}

	.muted {
		font-size: 0.92rem;
	}

	form {
		display: grid;
		gap: 0.75rem;
		width: 100%;
		margin-top: 0.75rem;
	}

	.alert {
		width: 100%;
		text-align: left;
	}
</style>
