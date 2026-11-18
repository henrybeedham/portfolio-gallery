<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import type { PageProps } from '../../../routes/admin/login/$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Sign in — {data.settings.siteTitle}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="login">
	<div class="card fade-up">
		<span class="mark" aria-hidden="true"
			>{data.settings.siteTitle.trim().charAt(0).toUpperCase() || '·'}</span
		>
		<h1>Welcome back</h1>
		<p class="site">{data.settings.siteTitle}</p>
		<p class="muted">Manage albums, photos and settings.</p>

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			<div class="field">
				<label for="username">Username</label>
				<input
					id="username"
					class="input"
					name="username"
					autocomplete="username"
					value={form?.username ?? ''}
					required
				/>
			</div>
			<div class="field">
				<label for="password">Password</label>
				<input
					id="password"
					class="input"
					type="password"
					name="password"
					autocomplete="current-password"
					required
				/>
			</div>

			{#if form?.error}
				<p class="alert alert-error" role="alert">{form.error}</p>
			{/if}

			<button class="btn btn-solid" disabled={submitting}>
				{#if submitting}<span class="spinner"></span> Signing In{:else}Sign In{/if}
			</button>
		</form>
	</div>

	<a class="link back" href="/"><ArrowLeft size={16} /> Back to the Gallery</a>
</main>

<style>
	.login {
		min-height: 100svh;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 1.5rem;
		padding: 2rem var(--gutter);
		background:
			radial-gradient(
				circle at 20% 0%,
				color-mix(in srgb, var(--ink) 10%, transparent),
				transparent 50%
			),
			radial-gradient(
				circle at 90% 100%,
				color-mix(in srgb, var(--ink) 7%, transparent),
				transparent 45%
			);
	}

	.card {
		width: min(100vw - 2rem, 420px);
		padding: clamp(1.75rem, 6vw, 2.5rem);
		border: 1px solid var(--edge);
		border-radius: var(--radius-xl);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-lg);
	}

	.mark {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		background: var(--ink);
		color: var(--bg);
		font-size: 1.3rem;
		font-weight: 800;
	}

	h1 {
		font-size: 2rem;
		font-weight: 800;
		letter-spacing: -0.04em;
		margin-top: 1.25rem;
	}

	.site {
		margin-top: 0.15rem;
		font-weight: 600;
		color: var(--highlight, var(--text-muted));
	}

	.muted {
		margin-top: 0.35rem;
		font-size: 0.92rem;
	}

	form {
		display: grid;
		gap: 1rem;
		margin-top: 1.75rem;
	}

	.btn {
		margin-top: 0.5rem;
		min-height: 48px;
	}
</style>
