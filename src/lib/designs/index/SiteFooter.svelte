<script lang="ts">
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import { copyrightText } from '#lib/utils.js';

	let { copyright, isAdmin = false }: { copyright: string; isAdmin?: boolean } = $props();
</script>

<footer class="footer">
	<div class="container grid-12 inner">
		<p class="copy">{copyrightText(copyright)}</p>
		<a class="link admin" href={isAdmin ? '/admin' : '/admin/login'}>
			{isAdmin ? 'Dashboard' : 'Admin'}
		</a>
		<a class="link top" href="#top">
			Top <ArrowUp size={13} strokeWidth={1.5} />
		</a>
	</div>
</footer>

<style>
	.footer {
		margin-top: clamp(4rem, 10vw, 8rem);
	}

	.inner {
		align-items: baseline;
		row-gap: 0.75rem;
		padding-top: 0.75rem;
		padding-bottom: 2rem;
	}

	.inner::before {
		content: '';
		grid-column: 1 / -1;
		height: 1px;
		margin-bottom: 0.25rem;
		background: var(--text);
	}

	.copy {
		grid-column: 1 / span 6;
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-muted);
	}

	.admin {
		grid-column: 7 / span 3;
	}

	.top {
		grid-column: 10 / -1;
		justify-self: end;
	}

	@media (max-width: 640px) {
		.copy {
			grid-column: 1 / -1;
		}

		.admin {
			grid-column: 1 / span 6;
		}

		.top {
			grid-column: 7 / -1;
		}
	}
</style>
