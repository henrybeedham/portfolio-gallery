<script lang="ts">
	import type { HTMLImgAttributes } from 'svelte/elements';

	let {
		eager = false,
		class: className = '',
		...rest
	}: HTMLImgAttributes & { eager?: boolean } = $props();

	let loaded = $state(false);

	/** Images that finished loading before hydration never fire `load`, so check on mount. */
	function checkComplete(node: HTMLImageElement) {
		if (node.complete && node.naturalWidth > 0) loaded = true;
	}
</script>

<img
	{...rest}
	class={['img', className, { loaded }]}
	loading={eager ? 'eager' : 'lazy'}
	decoding="async"
	onload={() => (loaded = true)}
	onerror={() => (loaded = true)}
	{@attach checkComplete}
/>

<style>
	.img {
		opacity: 0;
		transition:
			opacity 0.7s var(--ease),
			transform 0.9s var(--ease),
			filter 0.5s var(--ease);
	}

	.img.loaded {
		opacity: 1;
	}
</style>
