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
	<a class="btn btn-sm btn-quiet back" href="/"><ArrowLeft size={14} /> {siteTitle}</a>
	<div class="content">
		<span class="icon fade-up"><Lock size={18} strokeWidth={1.5} /></span>
		<p class="eyebrow fade-up" style:animation-delay="0.08s">Private gallery</p>
		<h1 class="fade-up" style:animation-delay="0.16s">{title}</h1>
		<p class="muted fade-up" style:animation-delay="0.24s">
			This gallery is password protected. Please enter the password you were given to view and
			download the photos.
		</p>
		<form
			class="fade-up"
			style:animation-delay="0.32s"
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
		position: relative;
		display: grid;
		place-items: center;
		min-height: 100svh;
		padding: 6rem var(--gutter) 4rem;
		overflow: hidden;
		isolation: isolate;
	}

	/* A slow spotlight, as if the house lights were down. */
	.gate::before {
		content: '';
		position: absolute;
		inset: -20%;
		z-index: -1;
		background: radial-gradient(
			ellipse 50% 45% at 50% 45%,
			var(--surface-strong) 0%,
			var(--bg) 70%
		);
		animation: cinema-fade-in 2.4s var(--ease) both;
	}

	.back {
		position: absolute;
		top: 1.25rem;
		left: var(--gutter);
		max-width: calc(100% - 2 * var(--gutter));
	}

	.content {
		display: grid;
		justify-items: center;
		gap: 1.1rem;
		width: min(100%, 640px);
		text-align: center;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--text) 7%, transparent);
	}

	h1 {
		font-size: clamp(3rem, 10vw, 7rem);
		line-height: 0.88;
		overflow-wrap: anywhere;
	}

	.muted {
		max-width: 44ch;
		font-size: 0.95rem;
	}

	form {
		display: flex;
		gap: 0.5rem;
		width: min(100%, 440px);
		margin-top: 0.75rem;
		padding: 0.35rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--pill);
		background: var(--bg-elevated);
		transition:
			border-color 0.3s var(--ease),
			box-shadow 0.3s var(--ease);
	}

	form:focus-within {
		border-color: var(--emphasis);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--emphasis) 16%, transparent);
	}

	form .input {
		flex: 1;
		min-width: 0;
		border: 0;
		border-radius: var(--pill);
		background: transparent;
		padding-left: 1rem;
		box-shadow: none;
	}

	.alert {
		width: min(100%, 440px);
		text-align: left;
	}

	@media (max-width: 420px) {
		form {
			flex-direction: column;
			border-radius: 22px;
		}
	}
</style>
