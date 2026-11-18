<script lang="ts">
	import { copyrightText } from '#lib/utils.js';

	let { copyright, isAdmin = false }: { copyright: string; isAdmin?: boolean } = $props();
</script>

<footer class="footer">
	<div class="container">
		<div class="inner">
			<p>{copyrightText(copyright)}</p>
			<a class="btn btn-sm btn-quiet" href={isAdmin ? '/admin' : '/admin/login'}
				>{isAdmin ? 'Dashboard' : 'Admin'}</a
			>
		</div>
	</div>
</footer>

<style>
	.footer {
		margin-top: clamp(3rem, 8vw, 6rem);
		padding-bottom: 1rem;
	}

	.inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.6rem 0.6rem 0.6rem 1.4rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		background: var(--bg-elevated);
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	@media (min-width: 640px) {
		.inner {
			border-radius: var(--radius-pill);
		}
	}
</style>
