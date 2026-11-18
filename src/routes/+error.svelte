<script lang="ts">
	// Renders the current design's ErrorPage (src/lib/designs/<id>/ErrorPage.svelte), or the Editorial one.
	import Editorial from '#lib/designs/editorial/ErrorPage.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/ErrorPage.svelte', {
		eager: true,
		import: 'default'
	});

	const Design = $derived(pick(designs, 'ErrorPage', Editorial));
</script>

<Design />
