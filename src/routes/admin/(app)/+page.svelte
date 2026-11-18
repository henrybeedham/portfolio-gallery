<script lang="ts">
	// Renders the current design's AdminDashboard (src/lib/designs/<id>/AdminDashboard.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/AdminDashboard.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/AdminDashboard.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'AdminDashboard', Editorial));
</script>

<Design {...props} />
