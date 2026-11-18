<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import { formatDateTime } from '#lib/utils.js';

	interface Props {
		title: string;
		expiresAt: string | null;
		contact: { email: string; phone: string };
	}

	let { title, expiresAt, contact }: Props = $props();
</script>

<main class="expired">
	<div class="card crop-marks fade-up">
		<span class="stamp warn tilt seal"><Clock size={12} strokeWidth={2} /> Expired</span>
		<div class="card-top">
			<p class="eyebrow">Gallery unavailable</p>
			<span class="reg-mark" aria-hidden="true"></span>
		</div>
		<h1>{title}</h1>
		<p class="muted">
			This gallery expired{expiresAt ? ` on ${formatDateTime(expiresAt)}` : ''} and is no longer available
			to view or download.
		</p>
		{#if contact.email || contact.phone}
			<div class="contact">
				<p>If you still need access to these photos, please get in touch.</p>
				<ul>
					{#if contact.email}
						<li>
							<Mail size={15} strokeWidth={1.5} />
							<a href="mailto:{contact.email}">{contact.email}</a>
						</li>
					{/if}
					{#if contact.phone}
						<li>
							<Phone size={15} strokeWidth={1.5} />
							<a href="tel:{contact.phone.replace(/[^\d+]/g, '')}">{contact.phone}</a>
						</li>
					{/if}
				</ul>
			</div>
		{/if}
		<a class="btn" href="/">Return Home</a>
	</div>
</main>

<style>
	.expired {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: 3rem var(--gutter);
	}

	.card {
		position: relative;
		display: grid;
		justify-items: start;
		gap: 1rem;
		width: min(100% - 14px, 540px);
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

	.contact {
		width: 100%;
		margin-block: 0.25rem;
		padding-block: 1rem;
		border-block: 1px solid var(--border);
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	ul {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--text);
		overflow-wrap: anywhere;
	}

	a:not(.btn) {
		color: var(--text);
		text-decoration: none;
		border-bottom: 1px solid var(--border-strong);
	}
</style>
