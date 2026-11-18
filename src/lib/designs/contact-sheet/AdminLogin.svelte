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
	<div class="card crop-marks fade-up">
		<div class="card-top">
			<p class="eyebrow">{data.settings.siteTitle}</p>
			<span class="reg-mark" aria-hidden="true"></span>
		</div>
		<h1>Sign In</h1>
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

	<a class="link back" href="/"><ArrowLeft size={14} /> Back to the gallery</a>
</main>

<style>
	.login {
		min-height: 100svh;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 2rem;
		padding: 2rem var(--gutter);
	}

	.card {
		width: min(100vw - 2.5rem, 420px);
		padding: clamp(1.5rem, 5vw, 2.25rem);
		border: var(--rule) solid var(--text);
		background: var(--bg-elevated);
	}

	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border-strong);
	}

	h1 {
		font-size: 3.2rem;
		margin-top: 1rem;
	}

	.muted {
		margin-top: 0.5rem;
		font-family: var(--font-sans);
		font-size: 0.95rem;
	}

	form {
		display: grid;
		gap: 1.1rem;
		margin-top: 1.75rem;
	}

	.btn {
		margin-top: 0.5rem;
	}
</style>
