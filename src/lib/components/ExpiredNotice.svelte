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
	<div class="card fade-up">
		<span class="icon"><Clock size={18} strokeWidth={1.5} /></span>
		<p class="eyebrow">Gallery unavailable</p>
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
		<a class="btn" href="/">Return home</a>
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
		display: grid;
		justify-items: center;
		gap: 1rem;
		width: min(100%, 520px);
		padding: clamp(2rem, 5vw, 3rem);
		border: 1px solid var(--border);
		background: var(--bg-elevated);
		text-align: center;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border: 1px solid var(--border-strong);
		margin-bottom: 0.5rem;
	}

	h1 {
		font-size: clamp(1.9rem, 5vw, 2.6rem);
	}

	.contact {
		width: 100%;
		margin-block: 0.5rem;
		padding-block: 1.25rem;
		border-block: 1px solid var(--border);
		font-size: 0.92rem;
		color: var(--text-muted);
	}

	ul {
		list-style: none;
		margin: 0.85rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
		justify-items: center;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--text);
	}

	a:not(.btn) {
		color: var(--text);
		text-decoration: none;
		border-bottom: 1px solid var(--border-strong);
	}
</style>
