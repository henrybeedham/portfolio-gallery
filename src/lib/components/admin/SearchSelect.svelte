<!--
	A type-to-filter picker, for lists too long for a plain <select> (linking an album, a job or an
	invoice). Choosing an option calls `onselect` and clears the field.
-->
<script lang="ts" module>
	export interface SearchOption {
		value: string;
		label: string;
		/** A quieter second line, e.g. the date or client. */
		detail?: string;
		/** Extra text to match on that isn't shown. */
		keywords?: string;
	}
</script>

<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import { matchesSearch } from '#lib/utils.js';

	let {
		options,
		onselect,
		label,
		placeholder = 'Search…',
		disabled = false,
		id
	}: {
		options: SearchOption[];
		onselect: (value: string) => void;
		label: string;
		placeholder?: string;
		disabled?: boolean;
		id?: string;
	} = $props();

	const listId = $props.id();
	let query = $state('');
	let open = $state(false);
	let active = $state(0);
	let list = $state<HTMLUListElement>();

	const matches = $derived(
		options
			.filter((option) => matchesSearch(query, option.label, option.detail, option.keywords))
			.slice(0, 50)
	);

	$effect(() => {
		void query;
		active = 0;
	});

	$effect(() => {
		list?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
	});

	function choose(option: SearchOption) {
		query = '';
		open = false;
		onselect(option.value);
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			open = true;
			active = Math.min(active + 1, matches.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (event.key === 'Enter' && open && matches[active]) {
			event.preventDefault();
			choose(matches[active]);
		} else if (event.key === 'Escape' && open) {
			event.preventDefault();
			open = false;
		}
	}
</script>

<div class="picker">
	<Search size={15} strokeWidth={1.5} aria-hidden="true" />
	<input
		{id}
		class="input"
		type="text"
		role="combobox"
		aria-label={label}
		aria-expanded={open}
		aria-controls={listId}
		aria-autocomplete="list"
		aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
		autocomplete="off"
		spellcheck="false"
		{placeholder}
		{disabled}
		bind:value={query}
		oninput={() => (open = true)}
		onfocus={() => (open = true)}
		onblur={() => (open = false)}
		{onkeydown}
	/>
	{#if open}
		<ul class="options" role="listbox" id={listId} bind:this={list}>
			{#each matches as option, i (option.value)}
				<li
					id="{listId}-{i}"
					role="option"
					aria-selected={i === active}
					class:active={i === active}
					data-index={i}
					onpointerdown={(event) => {
						// Before the input's blur closes the list.
						event.preventDefault();
						choose(option);
					}}
					onpointermove={() => (active = i)}
				>
					<span class="label">{option.label}</span>
					{#if option.detail}<span class="detail">{option.detail}</span>{/if}
				</li>
			{:else}
				<li class="none" role="presentation">Nothing matches “{query}”.</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.picker {
		position: relative;
		flex: 1;
		min-width: 0;
		color: var(--text-subtle);
	}

	.picker > :global(svg) {
		position: absolute;
		left: 0.8rem;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.input {
		padding-left: 2.3rem;
	}

	.options {
		position: absolute;
		top: calc(100% - 1px);
		left: 0;
		right: 0;
		z-index: 30;
		max-height: 280px;
		margin: 0;
		padding: 0.25rem 0;
		overflow-y: auto;
		list-style: none;
		border: 1px solid var(--text);
		background: var(--bg-elevated);
		color: var(--text);
	}

	li {
		display: grid;
		gap: 0.1rem;
		padding: 0.55rem 0.85rem;
		font-size: 0.9rem;
		cursor: pointer;
	}

	li.active {
		background: var(--surface);
	}

	.detail {
		font-size: 0.78rem;
		color: var(--text-subtle);
	}

	.none {
		color: var(--text-muted);
		cursor: default;
	}
</style>
