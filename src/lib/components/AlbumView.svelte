<script lang="ts">
	// Renders the current design's AlbumView (src/lib/designs/<id>/AlbumView.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/AlbumView.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/AlbumView.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'AlbumView', Editorial));
</script>

<Design {...props} />
