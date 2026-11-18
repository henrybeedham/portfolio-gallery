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
		<span class="icon"><Clock size={24} strokeWidth={2} /></span>
		<span class="kicker">Gallery unavailable</span>
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
							<a href="mailto:{contact.email}"><Mail size={16} strokeWidth={2} /> {contact.email}</a
							>
						</li>
					{/if}
					{#if contact.phone}
						<li>
							<a href="tel:{contact.phone.replace(/[^\d+]/g, '')}"
								><Phone size={16} strokeWidth={2} /> {contact.phone}</a
							>
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
		background: radial-gradient(
			circle at 50% 0%,
			color-mix(in srgb, var(--warning) 10%, transparent),
			transparent 60%
		);
	}

	.card {
		display: grid;
		justify-items: center;
		gap: 0.9rem;
		width: min(100%, 520px);
		padding: clamp(1.75rem, 5vw, 2.75rem);
		border: 1px solid var(--edge);
		border-radius: var(--radius-xl);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-lg);
		text-align: center;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 60px;
		height: 60px;
		margin-bottom: 0.4rem;
		border-radius: 20px;
		background: var(--warning-soft);
		color: var(--warning);
	}

	h1 {
		font-size: clamp(1.7rem, 5vw, 2.3rem);
		font-weight: 800;
		letter-spacing: -0.035em;
	}

	.contact {
		width: 100%;
		margin-block: 0.5rem;
		padding: 1.1rem;
		border-radius: var(--radius-lg);
		background: var(--surface);
		font-size: 0.92rem;
		color: var(--text-muted);
	}

	ul {
		list-style: none;
		margin: 0.85rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		justify-content: center;
	}

	li a {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 40px;
		padding: 0 1rem;
		border-radius: var(--radius-pill);
		background: var(--bg-elevated);
		box-shadow: var(--shadow-sm);
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
		overflow-wrap: anywhere;
	}
</style>
