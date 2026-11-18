<script lang="ts">
	import { copyrightText } from '#lib/utils.js';

	let { copyright, isAdmin = false }: { copyright: string; isAdmin?: boolean } = $props();
</script>

<footer class="footer">
	<div class="container">
		<span class="sprockets" aria-hidden="true"></span>
	</div>
	<div class="container inner">
		<p><span class="reg-mark" aria-hidden="true"></span> {copyrightText(copyright)}</p>
		<a class="link" href={isAdmin ? '/admin' : '/admin/login'}>{isAdmin ? 'Dashboard' : 'Admin'}</a>
	</div>
</footer>

<style>
	.footer {
		margin-top: clamp(4rem, 10vw, 8rem);
	}

	.inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 1.25rem 2rem;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	p {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
	}

	.reg-mark {
		width: 14px;
		height: 14px;
	}

	.link {
		font-size: 0.68rem;
	}
</style>
