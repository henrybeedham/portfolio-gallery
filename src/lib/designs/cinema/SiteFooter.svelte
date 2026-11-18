<script lang="ts">
	import { copyrightText } from '#lib/utils.js';

	let { copyright, isAdmin = false }: { copyright: string; isAdmin?: boolean } = $props();
</script>

<footer class="footer">
	<div class="container inner">
		<p class="credit">{copyrightText(copyright)}</p>
		<a class="link" href={isAdmin ? '/admin' : '/admin/login'}>{isAdmin ? 'Dashboard' : 'Admin'}</a>
	</div>
</footer>

<style>
	.footer {
		margin-top: clamp(4rem, 10vw, 8rem);
		border-top: 1px solid var(--border);
	}

	.inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 2rem 2.25rem;
	}

	.credit {
		font-family: var(--font-display);
		font-size: 0.86rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.link {
		font-size: 0.8rem;
	}
</style>
