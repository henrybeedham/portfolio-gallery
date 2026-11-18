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
	<div class="content">
		<span class="icon fade-up"><Clock size={18} strokeWidth={1.5} /></span>
		<p class="eyebrow fade-up" style:animation-delay="0.08s">Gallery unavailable</p>
		<h1 class="fade-up" style:animation-delay="0.16s">{title}</h1>
		<p class="muted fade-up" style:animation-delay="0.24s">
			This gallery expired{expiresAt ? ` on ${formatDateTime(expiresAt)}` : ''} and is no longer available
			to view or download.
		</p>
		{#if contact.email || contact.phone}
			<div class="contact fade-up" style:animation-delay="0.32s">
				<p>If you still need access to these photos, please get in touch.</p>
				<ul>
					{#if contact.email}
						<li>
							<a class="btn btn-sm" href="mailto:{contact.email}">
								<Mail size={14} strokeWidth={1.5} />
								{contact.email}
							</a>
						</li>
					{/if}
					{#if contact.phone}
						<li>
							<a class="btn btn-sm" href="tel:{contact.phone.replace(/[^\d+]/g, '')}">
								<Phone size={14} strokeWidth={1.5} />
								{contact.phone}
							</a>
						</li>
					{/if}
				</ul>
			</div>
		{/if}
		<a class="link fade-up" style:animation-delay="0.4s" href="/">Return Home</a>
	</div>
</main>

<style>
	.expired {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 100svh;
		padding: 4rem var(--gutter);
		overflow: hidden;
		isolation: isolate;
	}

	.expired::before {
		content: '';
		position: absolute;
		inset: -20%;
		z-index: -1;
		background: radial-gradient(
			ellipse 50% 45% at 50% 45%,
			var(--surface-strong) 0%,
			var(--bg) 70%
		);
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
		background: var(--warning-soft);
		color: var(--warning);
	}

	h1 {
		font-size: clamp(3rem, 10vw, 7rem);
		line-height: 0.88;
		overflow-wrap: anywhere;
		color: var(--text-muted);
	}

	.muted {
		max-width: 44ch;
	}

	.contact {
		display: grid;
		justify-items: center;
		gap: 0.9rem;
		margin-block: 0.5rem;
		font-size: 0.92rem;
		color: var(--text-muted);
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	ul .btn {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
