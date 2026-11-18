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
	<div class="title-card fade-in">
		<div class="frame">
			<span class="icon"><Clock size={16} strokeWidth={1.25} /></span>
			<p class="eyebrow">Gallery unavailable</p>
			<h1>{title}</h1>
			<div class="ornament" aria-hidden="true"></div>
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
								<Mail size={14} strokeWidth={1.5} />
								<a href="mailto:{contact.email}">{contact.email}</a>
							</li>
						{/if}
						{#if contact.phone}
							<li>
								<Phone size={14} strokeWidth={1.5} />
								<a href="tel:{contact.phone.replace(/[^\d+]/g, '')}">{contact.phone}</a>
							</li>
						{/if}
					</ul>
				</div>
			{/if}
			<a class="btn" href="/">Return Home</a>
		</div>
	</div>
</main>

<style>
	.expired {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: 3rem var(--gutter);
	}

	.title-card {
		width: min(100%, 540px);
	}

	.icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1px solid var(--border-strong);
		transform: rotate(45deg);
		margin-bottom: 0.5rem;
		color: var(--warning);
	}

	.icon :global(svg) {
		transform: rotate(-45deg);
	}

	.muted {
		font-style: italic;
	}

	.contact {
		width: 100%;
		margin-block: 0.5rem;
		padding-block: 1.25rem;
		border-block: 1px solid var(--border);
		color: var(--text-muted);
	}

	ul {
		list-style: none;
		margin: 0.85rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
		justify-items: center;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--text-subtle);
	}

	a:not(.btn) {
		color: var(--text);
		font-style: italic;
		text-decoration: underline;
		text-decoration-color: var(--border-strong);
		text-underline-offset: 4px;
		overflow-wrap: anywhere;
	}
</style>
