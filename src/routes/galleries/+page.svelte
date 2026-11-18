<script lang="ts">
	// Renders the current design's Galleries (src/lib/designs/<id>/Galleries.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/Galleries.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/Galleries.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'Galleries', Editorial));
</script>

<Design {...props} />
