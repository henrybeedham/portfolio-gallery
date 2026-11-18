<script lang="ts">
	// Renders the current design's AdminLogin (src/lib/designs/<id>/AdminLogin.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/AdminLogin.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/AdminLogin.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'AdminLogin', Editorial));
</script>

<Design {...props} />
