<script lang="ts">
	// Renders the current design's AdminShell (src/lib/designs/<id>/AdminShell.svelte), or the Editorial one.
	import Editorial from '#lib/designs/editorial/AdminShell.svelte';
	import { pick } from '#lib/designs/pick.js';
	import '#lib/components/admin/admin-ui.css';
	import type { LayoutProps } from './$types';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/AdminShell.svelte', {
		eager: true,
		import: 'default'
	});

	let { children, ...rest }: LayoutProps = $props();
	const Design = $derived(pick(designs, 'AdminShell', Editorial));
</script>

<Design {...rest}>{@render children()}</Design>
