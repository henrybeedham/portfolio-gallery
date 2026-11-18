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
	<div class="card crop-marks fade-up">
		<span class="stamp tilt seal"><Lock size={12} strokeWidth={2} /> Sealed</span>
		<div class="card-top">
			<p class="eyebrow">Private gallery · Lab envelope</p>
			<span class="reg-mark" aria-hidden="true"></span>
		</div>
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
		top: 1.5rem;
		left: var(--gutter);
	}

	.card {
		position: relative;
		display: grid;
		justify-items: start;
		gap: 1rem;
		width: min(100% - 14px, 480px);
		padding: clamp(1.5rem, 5vw, 2.5rem);
		border: var(--rule) solid var(--text);
		background: var(--bg-elevated);
		text-align: left;
	}

	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-strong);
	}

	.seal {
		position: absolute;
		top: -0.9rem;
		right: 1.25rem;
		background: var(--bg);
		font-size: 0.72rem;
		padding: 0.3rem 0.65rem;
	}

	h1 {
		font-size: clamp(2.2rem, 7vw, 3.4rem);
		line-height: 0.92;
		overflow-wrap: anywhere;
	}

	.muted {
		font-family: var(--font-sans);
		font-size: 0.95rem;
	}

	form {
		display: grid;
		gap: 0.6rem;
		width: 100%;
		margin-top: 0.5rem;
	}

	.alert {
		width: 100%;
	}
</style>
