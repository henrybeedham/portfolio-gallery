<script lang="ts">
	import { chipHref, rememberList } from '#lib/components/admin/list-memory.js';
	import SearchBox from '#lib/components/admin/SearchBox.svelte';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Plus from '@lucide/svelte/icons/plus';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import FilePlus from '@lucide/svelte/icons/file-plus';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import Images from '@lucide/svelte/icons/images';
	import FlagCheck from '#lib/components/admin/FlagCheck.svelte';
	import StateBadge from '#lib/components/admin/StateBadge.svelte';
	import StageIcon from '#lib/components/admin/StageIcon.svelte';
	import { stageLabels, stageOf, type Stage } from '#lib/job-stage.js';
	import { clashesFor } from '#lib/job-clash.js';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { formatMoney } from '#lib/money.js';
	import type { Booking } from '#lib/types.js';
	import { formatJobDate, invoiceLabel, matchesSearch, plural } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// So the back links on a job's page return to this filter and search.
	$effect(() => rememberList('jobs', page.url.search));
	let pending = $state<string | null>(null);
	let query = $state(page.url.searchParams.get('q') ?? '');

	const matching = $derived(
		data.bookings.filter((b) =>
			matchesSearch(
				query,
				b.title,
				b.client,
				b.location,
				b.billingLabel,
				b.notes,
				...b.invoices.map((invoice) => invoice.number),
				...b.albums.map((album) => album.title)
			)
		)
	);

	type Filter = 'active' | 'upcoming' | 'deliver' | 'invoice' | 'unpaid' | 'all';

	const filters: { id: Filter; label: string; test: (b: Booking) => boolean }[] = [
		{
			id: 'active',
			label: 'Active',
			// Done once it's happened, been delivered and been paid.
			test: (b) => b.status !== 'cancelled' && !(b.payment === 'paid' && b.delivered && !b.upcoming)
		},
		{ id: 'upcoming', label: 'Upcoming', test: (b) => b.status !== 'cancelled' && b.upcoming },
		{
			id: 'deliver',
			label: 'To deliver',
			test: (b) => b.status === 'confirmed' && !b.delivered && !b.upcoming
		},
		{
			id: 'invoice',
			label: 'To invoice',
			// Nothing sent yet: no invoices, or only drafts.
			test: (b) =>
				b.status === 'confirmed' && (b.payment === 'not-invoiced' || b.payment === 'draft')
		},
		{
			id: 'unpaid',
			label: 'Unpaid',
			test: (b) => b.status === 'confirmed' && b.payment !== 'paid'
		},
		{ id: 'all', label: 'All', test: () => true }
	];

	const filter = $derived(
		filters.find((f) => f.id === page.url.searchParams.get('show')) ?? filters[0]
	);
	// Date order, earliest first. “All” runs newest first so years of history don’t bury this term.
	const shown = $derived.by(() => {
		const list = matching.filter(filter.test);
		if (filter.id !== 'all') return list;
		const dated = list.filter((b) => b.startsAt).reverse();
		return [...list.filter((b) => !b.startsAt), ...dated];
	});
	const counts = $derived(
		Object.fromEntries(filters.map((f) => [f.id, matching.filter(f.test).length]))
	);

	/** Jobs whose times overlap another job's, with the titles of the others. */
	const clashing = $derived(
		new Map(
			data.bookings
				.map((b) => [b.id, clashesFor(b, data.bookings).filter((c) => c.overlap)] as const)
				.filter(([, clashes]) => clashes.length)
				.map(([id, clashes]) => [id, clashes.map((c) => c.job.title).join(', ')])
		)
	);

	// Matches the current chip hides, so a search on “Active” can still find an old job.
	const elsewhere = $derived(query.trim() ? matching.length - shown.length : 0);

	const shownStages = $derived(
		(Object.keys(stageLabels) as Stage[]).filter((stage) => shown.some((b) => stageOf(b) === stage))
	);

	const stats = $derived([
		{ label: 'Upcoming', value: String(data.stats.upcoming), href: '?show=upcoming' },
		{ label: 'To deliver', value: String(data.stats.toDeliver), href: '?show=deliver' },
		{ label: 'To invoice', value: String(data.stats.toInvoice), href: '?show=invoice' },
		{ label: 'Outstanding', value: formatMoney(data.stats.outstanding), href: '?show=unpaid' },
		{ label: 'Paid', value: formatMoney(data.stats.paid), href: null }
	]);

	async function setFlag(booking: Booking, flag: 'delivered', value: boolean) {
		pending = `${booking.id}:${flag}`;
		try {
			await api(`/admin/api/bookings/${booking.id}`, { action: 'set-flag', flag, value });
			await invalidate('admin:bookings');
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			pending = null;
		}
	}
</script>

<svelte:head>
	<title>Jobs — {data.settings.siteTitle}</title>
</svelte:head>

<header class="ui-head">
	<div>
		<p class="eyebrow">Work</p>
		<h1>Jobs</h1>
	</div>
	<div class="ui-actions">
		<a class="btn btn-quiet" href="/admin/jobs/calendar"><CalendarPlus size={14} /> Calendar</a>
		<a class="btn btn-quiet" href="/admin/jobs/import"><ClipboardPaste size={14} /> Import</a>
		<a class="btn btn-solid" href="/admin/jobs/new"><Plus size={14} /> New Job</a>
	</div>
</header>

<section class="ui-stats">
	{#each stats as stat (stat.label)}
		<svelte:element this={stat.href ? 'a' : 'div'} href={stat.href} class="ui-stat">
			<span class="eyebrow">{stat.label}</span>
			<strong>{stat.value}</strong>
		</svelte:element>
	{/each}
</section>

<section class="ui-panel">
	<div class="ui-panel-head">
		<SearchBox
			bind:value={query}
			label="Search jobs"
			placeholder="Search jobs, clients, invoices"
		/>
		<nav class="ui-chips" aria-label="Filter jobs">
			{#each filters as item (item.id)}
				<a
					class="ui-chip"
					class:active={filter.id === item.id}
					href={chipHref('/admin/jobs', item.id === 'active' ? null : item.id, query)}
					data-sveltekit-noscroll
					data-sveltekit-replacestate
				>
					{item.label} <span class="ui-count">{counts[item.id]}</span>
				</a>
			{/each}
		</nav>
	</div>

	{#if shown.length}
		{#if shownStages.length > 1}
			<ul class="key" aria-label="Stages">
				{#each shownStages as stage (stage)}
					<li class="stage-{stage}">
						<span class="stage-icon"><StageIcon {stage} /></span>{stageLabels[stage]}
					</li>
				{/each}
			</ul>
		{/if}
		<div class="ui-table-wrap">
			<table class="ui-table">
				<thead>
					<tr>
						<th>Date</th>
						<th>Job</th>
						<th class="ui-num">Fee</th>
						<th>Invoice</th>
						<th>Paid</th>
						<th>Delivered</th>
						<th class="ui-shrink"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each shown as booking (booking.id)}
						{@const when = formatJobDate(booking.startsAt, booking.endsAt)}
						{@const stage = stageOf(booking)}
						<tr class:ui-faded={booking.status === 'cancelled'} class="stage-{stage ?? 'none'}">
							<td class="date" title={stage ? stageLabels[stage] : undefined}>
								<div class="when">
									{#if stage}
										<span class="stage-icon" aria-hidden="true"><StageIcon {stage} /></span>
										<span class="visually-hidden">{stageLabels[stage]}:</span>
									{/if}
									<div>
										{#if when.day}
											<span class="day">{when.day}</span>
											{#if when.time}<span class="ui-sub">{when.time}</span>{/if}
											{#if clashing.has(booking.id)}
												<span
													class="ui-badge warn clash"
													title="Overlaps {clashing.get(booking.id)}"
												>
													Clash
												</span>
											{/if}
										{:else}
											<span class="ui-sub">Date TBC</span>
										{/if}
									</div>
								</div>
							</td>
							<td class="job">
								<a class="ui-title" href="/admin/jobs/{booking.id}">{booking.title}</a>
								<span class="ui-sub">
									{[booking.client, booking.billingLabel, booking.location]
										.filter(Boolean)
										.join(' · ')}
								</span>
								{#if booking.status !== 'confirmed'}
									<div class="status"><StateBadge state={booking.status} /></div>
								{/if}
							</td>
							<td class="ui-num">
								{#if booking.invoices.length}
									{formatMoney(booking.total)}
									{#if booking.payment === 'draft'}<span class="ui-sub">Draft</span>{/if}
									{#if booking.invoices.some((invoice) => invoice.sharedWith.length)}
										<span class="ui-sub">Shared invoice</span>
									{/if}
								{:else}
									<span class="none">—</span>
								{/if}
							</td>
							<td>
								<div class="ui-badges">
									{#each booking.invoices as invoice (invoice.id)}
										<a
											class="ui-badge"
											class:ok={invoice.state === 'paid'}
											class:danger={invoice.state === 'overdue'}
											class:draft={invoice.state === 'draft'}
											title={invoice.state === 'draft'
												? 'Draft, not sent yet'
												: invoice.imported
													? 'Imported record'
													: undefined}
											href="/admin/invoices/{invoice.id}"
										>
											{invoiceLabel(invoice.number)}
										</a>
									{/each}
									{#if !booking.invoices.length && booking.status !== 'cancelled'}
										<a class="create" href="/admin/invoices/new?job={booking.id}">Create</a>
									{/if}
								</div>
							</td>
							<td>
								{#if booking.payment === 'not-invoiced' || booking.payment === 'draft'}
									<span class="none">—</span>
								{:else}
									<StateBadge state={booking.payment} />
								{/if}
							</td>
							<td>
								<div class="delivered">
									<FlagCheck
										on={booking.delivered}
										label={booking.delivered ? 'Mark as not delivered' : 'Mark as delivered'}
										busy={pending === `${booking.id}:delivered`}
										onclick={() => setFlag(booking, 'delivered', !booking.delivered)}
									/>
									{#each booking.albums as album (album.id)}
										<a class="album" href="/admin/albums/{album.id}" title="Open album">
											<Images size={13} strokeWidth={1.5} />
											<span>{album.title}</span>
										</a>
									{/each}
								</div>
							</td>
							<td class="ui-shrink">
								<div class="ui-row-actions">
									<a
										class="ui-icon-btn"
										href="/admin/invoices/new?job={booking.id}"
										title="New invoice"
										aria-label="New invoice for {booking.title}"
									>
										<FilePlus size={15} strokeWidth={1.5} />
									</a>
									<a
										class="ui-icon-btn"
										href="/admin/jobs/{booking.id}"
										title="Edit"
										aria-label="Edit {booking.title}"
									>
										<Pencil size={15} strokeWidth={1.5} />
									</a>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if data.bookings.length}
		<div class="ui-empty">
			<h3>Nothing here</h3>
			{#if query.trim()}
				<p>No {filter.id === 'all' ? '' : `“${filter.label}” `}jobs match “{query.trim()}”.</p>
			{:else}
				<p>No jobs match “{filter.label}”.</p>
			{/if}
		</div>
	{:else}
		<div class="ui-empty">
			<Briefcase size={28} strokeWidth={1} />
			<h3>No jobs yet</h3>
			<p>Add your first job, or bring in the ones from your spreadsheet.</p>
			<div class="ui-inline">
				<a class="btn btn-quiet" href="/admin/jobs/import"><ClipboardPaste size={14} /> Import</a>
				<a class="btn btn-solid" href="/admin/jobs/new"><Plus size={14} /> New Job</a>
			</div>
		</div>
	{/if}
	{#if elsewhere > 0}
		<p class="ui-elsewhere">
			{plural(elsewhere, 'more match', 'more matches')} in other filters.
			<a href={chipHref('/admin/jobs', 'all', query)} data-sveltekit-noscroll>Search all jobs</a>
		</p>
	{/if}
</section>

<style>
	tr:not(.stage-none) .date {
		box-shadow: inset 4px 0 0 var(--stage);
	}

	/* Tentative jobs get a dashed stripe: not settled yet. */
	tr.stage-tentative .date {
		box-shadow: none;
		background: repeating-linear-gradient(to bottom, var(--stage) 0 5px, transparent 5px 9px) left /
			4px 100% no-repeat;
	}

	.when {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
	}

	.key {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.25rem;
		margin: 0;
		padding: 0.75rem 1.5rem;
		list-style: none;
		border-bottom: 1px solid var(--border);
		font-size: 0.66rem;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.key li {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.key .stage-icon {
		margin-top: 0;
	}

	.date {
		white-space: nowrap;
		width: 1%;
	}

	.clash {
		margin-top: 0.3rem;
	}

	.day {
		display: block;
		font-variant-numeric: tabular-nums;
	}

	.job {
		min-width: 220px;
	}

	.status {
		margin-top: 0.35rem;
	}

	.ui-badge.draft {
		border-style: dashed;
		color: var(--text-muted);
	}

	.none {
		color: var(--text-subtle);
	}

	.create {
		font-size: 0.66rem;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-muted);
		text-decoration: none;
		border-bottom: 1px solid var(--border-strong);
	}

	.create:hover {
		color: var(--text);
		border-color: var(--text);
	}

	.delivered {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		min-width: 120px;
	}

	.album {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		max-width: 180px;
		font-size: 0.8rem;
		color: var(--text-muted);
		text-decoration: none;
	}

	.album span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.album:hover {
		color: var(--text);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
