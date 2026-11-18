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
	<aside class="poster" aria-hidden="true">
		{#if data.settings.heroImage}
			<img src="/site/hero/small?v={data.settings.heroImage}" alt="" />
		{/if}
		<span class="poster-title">{data.settings.siteTitle}</span>
	</aside>

	<div class="panel">
		<a class="link back" href="/"><ArrowLeft size={14} /> Back to the Gallery</a>
		<div class="form-wrap fade-up">
			<p class="eyebrow">Admin</p>
			<h1>Sign In</h1>
			<p class="muted">Manage albums, photos, jobs and invoices.</p>

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
	</div>
</main>

<style>
	.login {
		display: grid;
		min-height: 100svh;
	}

	@media (min-width: 900px) {
		.login {
			grid-template-columns: minmax(0, 1.4fr) minmax(400px, 1fr);
		}
	}

	.poster {
		position: relative;
		display: grid;
		align-items: end;
		min-height: 34svh;
		padding: clamp(1.25rem, 4vw, 3rem);
		overflow: hidden;
		background: var(--placeholder);
		isolation: isolate;
	}

	.poster img {
		position: absolute;
		inset: 0;
		z-index: -2;
		width: 100%;
		height: 100%;
		object-fit: cover;
		animation: cinema-fade-in 2s var(--ease) both;
	}

	.poster::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: linear-gradient(to top, var(--scrim-strong) 0%, transparent 55%);
	}

	.poster-title {
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 6vw, 5.5rem);
		font-weight: 500;
		line-height: 0.9;
		text-transform: uppercase;
		max-width: 12ch;
	}

	.panel {
		position: relative;
		display: grid;
		place-items: center;
		padding: clamp(4rem, 8vw, 6rem) var(--gutter) 3rem;
		background: var(--bg);
	}

	.back {
		position: absolute;
		top: 1.5rem;
		left: var(--gutter);
	}

	.form-wrap {
		width: min(100%, 380px);
	}

	h1 {
		font-size: clamp(3rem, 6vw, 4.5rem);
		margin-top: 0.6rem;
	}

	.muted {
		margin-top: 0.75rem;
		font-size: 0.95rem;
	}

	form {
		display: grid;
		gap: 1.1rem;
		margin-top: 2rem;
	}

	form .btn {
		margin-top: 0.5rem;
	}
</style>
