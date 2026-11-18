<script lang="ts">
	// Renders the current design's Lightbox (src/lib/designs/<id>/Lightbox.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/Lightbox.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/Lightbox.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'Lightbox', Editorial));
</script>

<Design {...props} />
