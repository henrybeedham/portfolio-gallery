<script lang="ts">
	// Renders the current design's SiteHeader (src/lib/designs/<id>/SiteHeader.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/SiteHeader.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/SiteHeader.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'SiteHeader', Editorial));
</script>

<Design {...props} />
