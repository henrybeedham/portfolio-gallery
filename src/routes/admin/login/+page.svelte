<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import { getPasskey, isCancelled, passkeysSupported } from '#lib/passkey-client.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let submitting = $state(false);
	let supported = $state(false);
	let passkeyBusy = $state(false);
	let passkeyError = $state<string | null>(null);

	onMount(() => (supported = passkeysSupported()));

	async function post(body: unknown) {
		const response = await fetch('/admin/login/passkey', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const result = await response.json().catch(() => ({}));
		if (!response.ok) throw new Error(result?.message ?? 'Signing in with a passkey failed.');
		return result;
	}

	async function signInWithPasskey() {
		passkeyBusy = true;
		passkeyError = null;
		try {
			const options = await post({ action: 'options' });
			const response = await getPasskey(options);
			await post({ action: 'verify', response });
			await invalidateAll();
			await goto(data.next);
		} catch (error) {
			if (!isCancelled(error)) passkeyError = (error as Error).message;
		} finally {
			passkeyBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in — {data.settings.siteTitle}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="login">
	<div class="card fade-up">
		<p class="eyebrow">{data.settings.siteTitle}</p>
		<h1>Sign in</h1>
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
				{#if submitting}<span class="spinner"></span> Signing in{:else}Sign in{/if}
			</button>
		</form>

		{#if data.passkeys && supported}
			<div class="passkey">
				<span class="or">or</span>
				<button class="btn" onclick={signInWithPasskey} disabled={passkeyBusy}>
					{#if passkeyBusy}<span class="spinner"></span>{:else}<KeyRound size={14} />{/if}
					Sign In with Passkey
				</button>
				{#if passkeyError}
					<p class="alert alert-error" role="alert">{passkeyError}</p>
				{/if}
			</div>
		{/if}
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
		width: min(100vw - 2rem, 420px);
		padding: clamp(2rem, 6vw, 3rem);
		border: 1px solid var(--border);
		background: var(--bg-elevated);
	}

	h1 {
		font-size: 2.6rem;
		margin-top: 0.85rem;
	}

	.muted {
		margin-top: 0.5rem;
		font-size: 0.92rem;
	}

	form {
		display: grid;
		gap: 1.25rem;
		margin-top: 2rem;
	}

	.btn {
		margin-top: 0.5rem;
	}

	.passkey {
		display: grid;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.or {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.68rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.or::before,
	.or::after {
		content: '';
		flex: 1;
		border-top: 1px solid var(--border);
	}

	.passkey .btn {
		margin-top: 0;
	}
</style>
