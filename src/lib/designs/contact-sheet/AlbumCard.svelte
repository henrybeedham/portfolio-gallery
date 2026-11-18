<script lang="ts">
	// The slot keeps Editorial's props; Home and Galleries render Roll directly to number the rolls.
	import Roll from './Roll.svelte';
	import type { AlbumCardData } from '#lib/types.js';

	interface Props {
		album: AlbumCardData;
		shape?: 'natural' | 'portrait';
		eager?: boolean;
	}

	let { album, eager = false }: Props = $props();
</script>

<Roll {album} {eager} />
