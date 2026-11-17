<!--
	A search field for admin lists. The text is mirrored into the URL as ?q= (without a navigation),
	so reloading, sharing or coming back from a detail page keeps the search.
-->
<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';

	let {
		value = $bindable(''),
		label,
		placeholder = 'Search'
	}: { value?: string; label: string; placeholder?: string } = $props();

	let input = $state<HTMLInputElement>();
	let timer: ReturnType<typeof setTimeout> | undefined;

	function sync() {
		clearTimeout(timer);
		timer = setTimeout(() => {
			const url = new URL(page.url.href);
			if (value.trim()) url.searchParams.set('q', value.trim());
			else url.searchParams.delete('q');
			if (url.search !== page.url.search) replaceState(url, page.state);
		}, 250);
	}

	function clear() {
		value = '';
		sync();
		input?.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && value) {
			event.preventDefault();
			clear();
		}
	}
</script>

<div class="search">
	<Search size={15} strokeWidth={1.5} aria-hidden="true" />
	<input
		bind:this={input}
		bind:value
		oninput={sync}
		{onkeydown}
		type="search"
		class="input"
		aria-label={label}
		{placeholder}
		autocomplete="off"
		spellcheck="false"
	/>
	{#if value}
		<button type="button" class="clear" onclick={clear} aria-label="Clear search">
			<X size={14} strokeWidth={1.5} />
		</button>
	{/if}
</div>

<style>
	.search {
		position: relative;
		display: flex;
		align-items: center;
		width: min(100%, 300px);
		color: var(--text-subtle);
	}

	.search :global(svg:first-child) {
		position: absolute;
		left: 0.75rem;
		pointer-events: none;
	}

	.input {
		min-height: 36px;
		padding: 0.4rem 2.2rem;
		font-size: 0.88rem;
	}

	/* The browser's own clear button doubles up with ours. */
	.input::-webkit-search-cancel-button {
		display: none;
	}

	.clear {
		position: absolute;
		right: 0.35rem;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 0;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
	}

	.clear:hover {
		color: var(--text);
	}
</style>
