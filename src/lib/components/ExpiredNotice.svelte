<script lang="ts">
	// Renders the current design's ExpiredNotice (src/lib/designs/<id>/ExpiredNotice.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/ExpiredNotice.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/ExpiredNotice.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'ExpiredNotice', Editorial));
</script>

<Design {...props} />
