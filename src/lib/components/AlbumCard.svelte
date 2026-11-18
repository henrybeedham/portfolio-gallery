<script lang="ts">
	// Renders the current design's AlbumCard (src/lib/designs/<id>/AlbumCard.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/AlbumCard.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/AlbumCard.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'AlbumCard', Editorial));
</script>

<Design {...props} />
