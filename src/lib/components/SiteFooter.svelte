<script lang="ts">
	// Renders the current design's SiteFooter (src/lib/designs/<id>/SiteFooter.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/SiteFooter.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/SiteFooter.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'SiteFooter', Editorial));
</script>

<Design {...props} />
