<!--
	Admin-wide search, opened with ⌘K / Ctrl+K or the sidebar button. Finds pages, galleries, jobs,
	invoices and clients. The index is fetched each time it opens and filtered as you type.
-->
<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import Search from '@lucide/svelte/icons/search';
	import CornerDownLeft from '@lucide/svelte/icons/corner-down-left';
	import Images from '@lucide/svelte/icons/images';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import Receipt from '@lucide/svelte/icons/receipt';
	import User from '@lucide/svelte/icons/user';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import type { SearchEntry } from '#lib/types.js';
	import { matchesSearch } from '#lib/utils.js';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	type Entry = Omit<SearchEntry, 'kind'> & { kind: SearchEntry['kind'] | 'page' };

	const PAGES: Entry[] = [
		['Dashboard', '/admin'],
		['Galleries', '/admin/albums'],
		['New Album', '/admin/albums/new'],
		['Jobs', '/admin/jobs'],
		['New Job', '/admin/jobs/new'],
		['Calendar Feed', '/admin/jobs/calendar'],
		['Invoices', '/admin/invoices'],
		['New Invoice', '/admin/invoices/new'],
		['Invoice Settings', '/admin/invoices/settings'],
		['Tax Year Export', '/admin/invoices/tax-year'],
		['Analytics', '/admin/analytics'],
		['Lightroom', '/admin/lightroom'],
		['Backups', '/admin/backups'],
		['Settings', '/admin/settings']
	].map(([title, href]) => ({ kind: 'page', title, detail: '', href, keywords: '' }));

	const GROUPS: { kind: Entry['kind']; label: string; limit: number }[] = [
		{ kind: 'page', label: 'Pages', limit: 4 },
		{ kind: 'job', label: 'Jobs', limit: 6 },
		{ kind: 'gallery', label: 'Galleries', limit: 5 },
		{ kind: 'invoice', label: 'Invoices', limit: 5 },
		{ kind: 'client', label: 'Clients', limit: 4 }
	];

	const ICONS = {
		page: ArrowRight,
		gallery: Images,
		job: Briefcase,
		invoice: Receipt,
		client: User
	};

	let query = $state('');
	let active = $state(0);
	let index = $state<SearchEntry[]>([]);
	let loading = $state(false);
	let failed = $state(false);
	let input = $state<HTMLInputElement>();
	let list = $state<HTMLElement>();
	let returnFocus: HTMLElement | null = null;

	const groups = $derived.by(() => {
		const q = query.trim();
		// With nothing typed, offer the pages to jump to.
		if (!q) return [{ kind: 'page' as const, label: 'Go to', items: PAGES }];
		return GROUPS.map((group) => ({
			...group,
			items: (group.kind === 'page' ? PAGES : index.filter((entry) => entry.kind === group.kind))
				.filter((entry) => matchesSearch(q, entry.title, entry.detail, entry.keywords))
				.slice(0, group.limit)
		})).filter((group) => group.items.length);
	});
	const flat = $derived(groups.flatMap((group) => group.items));

	$effect(() => {
		void query;
		active = 0;
	});

	$effect(() => {
		list?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
	});

	$effect(() => {
		if (!open) return;
		returnFocus = document.activeElement as HTMLElement | null;
		query = '';
		load();
		requestAnimationFrame(() => input?.focus());
		return () => returnFocus?.focus?.();
	});

	async function load() {
		loading = true;
		failed = false;
		try {
			const response = await fetch('/admin/api/search');
			if (!response.ok) throw new Error();
			index = await response.json();
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	function close() {
		open = false;
	}

	async function choose(entry: Entry) {
		close();
		await goto(entry.href);
	}

	function onwindowkeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			open = !open;
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			active = Math.min(active + 1, flat.length - 1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (event.key === 'Enter' && flat[active]) {
			event.preventDefault();
			choose(flat[active]);
		}
	}
</script>

<svelte:window onkeydown={onwindowkeydown} />

{#if open}
	<div class="backdrop" transition:fade={{ duration: 180 }}>
		<button class="scrim" tabindex="-1" aria-label="Close search" onclick={close}></button>
		<div
			class="palette"
			role="dialog"
			aria-modal="true"
			aria-label="Search"
			transition:scale={{ start: 0.97, duration: 200 }}
		>
			<div class="field">
				<Search size={17} strokeWidth={1.5} aria-hidden="true" />
				<input
					bind:this={input}
					bind:value={query}
					{onkeydown}
					type="text"
					role="combobox"
					aria-expanded="true"
					aria-controls="palette-results"
					aria-activedescendant={flat[active] ? `palette-${active}` : undefined}
					aria-label="Search galleries, jobs, invoices and clients"
					placeholder="Search galleries, jobs, invoices, clients…"
					autocomplete="off"
					spellcheck="false"
				/>
				<kbd>Esc</kbd>
			</div>

			<div class="results" id="palette-results" role="listbox" bind:this={list}>
				{#each groups as group (group.kind)}
					{@const offset = flat.indexOf(group.items[0])}
					<div role="group" aria-label={group.label}>
						<p class="group-label" aria-hidden="true">{group.label}</p>
						{#each group.items as entry, i (entry.href + entry.title)}
							{@const Icon = ICONS[entry.kind]}
							<div
								id="palette-{offset + i}"
								class="result"
								class:active={offset + i === active}
								role="option"
								aria-selected={offset + i === active}
								data-index={offset + i}
								tabindex="-1"
								onclick={() => choose(entry)}
								onkeydown={() => {}}
								onpointermove={() => (active = offset + i)}
							>
								<span class="icon"><Icon size={15} strokeWidth={1.5} /></span>
								<span class="text">
									<span class="title">{entry.title}</span>
									{#if entry.detail}<span class="detail">{entry.detail}</span>{/if}
								</span>
								{#if offset + i === active}
									<span class="enter" aria-hidden="true"><CornerDownLeft size={13} /></span>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<p class="status">
						{#if loading}
							Searching…
						{:else if failed}
							Search isn’t available right now. Try again in a moment.
						{:else}
							Nothing matches “{query.trim()}”.
						{/if}
					</p>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 240;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 12vh 1rem 1rem;
		background: rgba(20, 18, 15, 0.45);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
	}

	.scrim {
		position: absolute;
		inset: 0;
		border: 0;
		background: none;
		cursor: default;
	}

	.palette {
		position: relative;
		display: flex;
		flex-direction: column;
		width: min(100%, 600px);
		max-height: min(560px, 76vh);
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.25);
	}

	.field {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0 1.1rem;
		border-bottom: 1px solid var(--border);
		color: var(--text-subtle);
	}

	.field input {
		flex: 1;
		min-width: 0;
		height: 56px;
		border: 0;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: 1.02rem;
		outline: none;
	}

	kbd {
		padding: 0.15rem 0.4rem;
		border: 1px solid var(--border-strong);
		font-family: var(--font-sans);
		font-size: 0.66rem;
		letter-spacing: 0.08em;
		color: var(--text-subtle);
	}

	.results {
		overflow-y: auto;
		padding: 0.4rem 0 0.6rem;
	}

	.group-label {
		margin: 0;
		padding: 0.75rem 1.1rem 0.35rem;
		font-size: 0.64rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.result {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		padding: 0.55rem 1.1rem;
		border-left: 2px solid transparent;
		cursor: pointer;
	}

	.result.active {
		background: var(--surface);
		border-left-color: var(--highlight, var(--text));
	}

	.icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 30px;
		height: 30px;
		border: 1px solid var(--border);
		color: var(--text-muted);
	}

	.text {
		display: grid;
		flex: 1;
		min-width: 0;
	}

	.title,
	.detail {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title {
		font-size: 0.92rem;
	}

	.detail {
		font-size: 0.76rem;
		color: var(--text-subtle);
	}

	.enter {
		color: var(--text-subtle);
	}

	.status {
		margin: 0;
		padding: 2rem 1.1rem;
		text-align: center;
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	@media (max-width: 520px) {
		.backdrop {
			padding-top: 1rem;
		}

		kbd {
			display: none;
		}
	}
</style>
