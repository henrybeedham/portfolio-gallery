<script lang="ts">
	import { copyrightText } from '#lib/utils.js';

	let { copyright, isAdmin = false }: { copyright: string; isAdmin?: boolean } = $props();
</script>

<footer class="colophon">
	<div class="container inner">
		<div class="ornament" aria-hidden="true"></div>
		<hr class="double-rule" />
		<p class="copy">{copyrightText(copyright)}</p>
		<a class="link" href={isAdmin ? '/admin' : '/admin/login'}>{isAdmin ? 'Dashboard' : 'Admin'}</a>
	</div>
</footer>

<style>
	.colophon {
		margin-top: clamp(5rem, 12vw, 9rem);
	}

	.inner {
		display: grid;
		justify-items: center;
		gap: 1.25rem;
		padding-bottom: 2.5rem;
		text-align: center;
	}

	.double-rule {
		width: 100%;
		margin-top: 1.25rem;
	}

	.copy {
		margin-top: 0.75rem;
		font-style: italic;
		font-size: 0.98rem;
		color: var(--text-muted);
	}

	.link {
		font-size: 0.92rem;
		color: var(--text-subtle);
	}
</style>
