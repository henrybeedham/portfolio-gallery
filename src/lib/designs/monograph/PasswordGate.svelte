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
	<a class="link back" href="/"><ArrowLeft size={14} strokeWidth={1.5} /> {siteTitle}</a>
	<div class="title-card fade-in">
		<div class="frame">
			<span class="icon"><Lock size={16} strokeWidth={1.25} /></span>
			<p class="eyebrow">A private gallery</p>
			<h1>{title}</h1>
			<div class="ornament" aria-hidden="true"></div>
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

	.icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1px solid var(--border-strong);
		transform: rotate(45deg);
		margin-bottom: 0.5rem;
		color: var(--highlight, var(--text-muted));
	}

	.icon :global(svg) {
		transform: rotate(-45deg);
	}

	.muted {
		font-style: italic;
		max-width: 30ch;
	}

	form {
		display: grid;
		gap: 1.25rem;
		width: 100%;
		margin-top: 0.75rem;
	}

	.input {
		text-align: center;
	}

	.alert {
		width: 100%;
		text-align: left;
	}
</style>
