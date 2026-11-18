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
	<a class="back" href="/"><ArrowLeft size={16} strokeWidth={2} /> {siteTitle}</a>
	<div class="card fade-up">
		<span class="icon"><Lock size={24} strokeWidth={2} /></span>
		<span class="kicker">Private gallery</span>
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
		padding: 5.5rem var(--gutter) 3rem;
		position: relative;
		background: radial-gradient(
			circle at 50% 0%,
			color-mix(in srgb, var(--ink) 8%, transparent),
			transparent 60%
		);
	}

	.back {
		position: absolute;
		top: 1.25rem;
		left: var(--gutter);
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 40px;
		padding: 0 1rem 0 0.75rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-pill);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-sm);
		font-size: 0.88rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--text-muted);
		transition:
			color var(--dur) var(--ease),
			transform var(--dur) var(--ease);
	}

	.back:hover {
		color: var(--text);
		transform: translateY(-1px);
	}

	.card {
		display: grid;
		justify-items: center;
		gap: 0.9rem;
		width: min(100%, 440px);
		padding: clamp(1.75rem, 5vw, 2.75rem);
		border: 1px solid var(--edge);
		border-radius: var(--radius-xl);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-lg);
		text-align: center;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 60px;
		height: 60px;
		margin-bottom: 0.4rem;
		border-radius: 20px;
		background: color-mix(in srgb, var(--ink) 12%, transparent);
		color: var(--highlight, var(--text));
	}

	h1 {
		font-size: clamp(1.7rem, 5vw, 2.3rem);
		font-weight: 800;
		letter-spacing: -0.035em;
	}

	.muted {
		font-size: 0.92rem;
	}

	form {
		display: grid;
		gap: 0.6rem;
		width: 100%;
		margin-top: 0.75rem;
	}

	.input {
		min-height: 50px;
		border-radius: var(--radius-pill);
		padding-inline: 1.25rem;
		text-align: center;
	}

	.btn {
		min-height: 50px;
	}

	.alert {
		width: 100%;
		text-align: left;
	}
</style>
