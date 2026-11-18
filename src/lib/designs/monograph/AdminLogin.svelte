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
	<div class="title-card fade-in">
		<div class="frame">
			<p class="eyebrow">{data.settings.siteTitle}</p>
			<h1>Sign In</h1>
			<div class="ornament" aria-hidden="true"></div>
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
	</div>

	<a class="link back" href="/"><ArrowLeft size={14} strokeWidth={1.5} /> Back to the Gallery</a>
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

	.title-card {
		width: min(100vw - 2rem, 440px);
	}

	.muted {
		font-style: italic;
	}

	form {
		display: grid;
		gap: 1.4rem;
		width: 100%;
		margin-top: 1rem;
		text-align: left;
	}

	.btn {
		margin-top: 0.5rem;
	}
</style>
