<script lang="ts">
	import { copyrightText } from '#lib/utils.js';

	let {
		copyright,
		title,
		isAdmin = false
	}: { copyright: string; title: string; isAdmin?: boolean } = $props();
</script>

<footer class="footer">
	<div class="container inner">
		<p>{copyrightText(copyright, title)}</p>
		<a class="link" href={isAdmin ? '/admin' : '/admin/login'}>{isAdmin ? 'Dashboard' : 'Admin'}</a>
	</div>
</footer>

<style>
	.footer {
		border-top: 1px solid var(--border);
		margin-top: clamp(4rem, 10vw, 8rem);
	}

	.inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 2.25rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.link {
		font-size: 0.65rem;
	}
</style>
