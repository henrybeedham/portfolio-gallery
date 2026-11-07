<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { listPath, listUrl, type ListName } from './list-memory.js';

	let { list, label }: { list: ListName; label: string } = $props();

	// Rendered without the filter on the server; the remembered one is filled in once mounted.
	let href = $state(untrack(() => listPath(list)));
	onMount(() => {
		href = listUrl(list);
	});
</script>

<a class="link" {href}><ArrowLeft size={14} /> {label}</a>
