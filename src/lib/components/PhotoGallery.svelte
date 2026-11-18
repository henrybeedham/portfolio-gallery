<script lang="ts">
	// Renders the current design's PhotoGallery (src/lib/designs/<id>/PhotoGallery.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/PhotoGallery.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/PhotoGallery.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'PhotoGallery', Editorial));
</script>

<Design {...props} />
