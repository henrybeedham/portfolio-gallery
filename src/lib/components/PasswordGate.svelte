<script lang="ts">
	// Renders the current design's PasswordGate (src/lib/designs/<id>/PasswordGate.svelte), or the Editorial one.
	import type { ComponentProps } from 'svelte';
	import Editorial from '#lib/designs/editorial/PasswordGate.svelte';
	import { pick } from '#lib/designs/pick.js';

	const designs = import.meta.glob<typeof Editorial>('/src/lib/designs/*/PasswordGate.svelte', {
		eager: true,
		import: 'default'
	});

	let props: ComponentProps<typeof Editorial> = $props();
	const Design = $derived(pick(designs, 'PasswordGate', Editorial));
</script>

<Design {...props} />
