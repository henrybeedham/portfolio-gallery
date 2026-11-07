<script lang="ts">
	import { rememberList } from '#lib/components/admin/list-memory.js';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Download from '@lucide/svelte/icons/download';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Settings from '@lucide/svelte/icons/settings';
	import Receipt from '@lucide/svelte/icons/receipt';
	import FlagCheck from '#lib/components/admin/FlagCheck.svelte';
	import StateBadge from '#lib/components/admin/StateBadge.svelte';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { formatMoney } from '#lib/money.js';
	import type { InvoiceSummary } from '#lib/types.js';
	import { formatShortDay, plural } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// So the back links on a invoice's page return to this filter.
	$effect(() => rememberList('invoices', page.url.search));
	let pending = $state<number | null>(null);

	type Filter = 'all' | 'unpaid' | 'overdue' | 'paid';
	const filters: { id: Filter; label: string; test: (i: InvoiceSummary) => boolean }[] = [
		{ id: 'all', label: 'All', test: () => true },
		{ id: 'unpaid', label: 'Unpaid', test: (i) => i.state !== 'paid' },
		{ id: 'overdue', label: 'Overdue', test: (i) => i.state === 'overdue' },
		{ id: 'paid', label: 'Paid', test: (i) => i.state === 'paid' }
	];
	const filter = $derived(
		filters.find((f) => f.id === page.url.searchParams.get('show')) ?? filters[0]
	);
	const shown = $derived(data.invoices.filter(filter.test));

	async function togglePaid(invoice: InvoiceSummary) {
		pending = invoice.id;
		try {
			await api(`/admin/api/invoices/${invoice.id}`, {
				action: 'set-paid',
				paid: invoice.state !== 'paid'
			});
			await invalidate('admin:invoices');
			feedback.toast(
				invoice.state === 'paid'
					? `${invoice.number} marked unpaid`
					: `${invoice.number} marked paid`
			);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			pending = null;
		}
	}

	async function remove(invoice: InvoiceSummary) {
		const ok = await feedback.confirm({
			title: `Delete invoice ${invoice.number}?`,
			message: 'This permanently deletes the invoice.',
			confirmLabel: 'Delete invoice',
			danger: true
		});
		if (!ok) return;
		try {
			await api(`/admin/api/invoices/${invoice.id}`, undefined, 'DELETE');
			await invalidate('admin:invoices');
			feedback.toast(`Deleted invoice ${invoice.number}`);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		}
	}
</script>

<svelte:head>
	<title>Invoices — {data.settings.siteTitle}</title>
</svelte:head>

<header class="ui-head">
	<div>
		<p class="eyebrow">Billing</p>
		<h1>Invoices</h1>
	</div>
	<div class="ui-actions">
		<a class="btn btn-quiet" href="/admin/invoices/settings"><Settings size={14} /> Settings</a>
		<a class="btn btn-solid" href="/admin/invoices/new"><Plus size={14} /> New Invoice</a>
	</div>
</header>

<section class="ui-stats">
	<a class="ui-stat" href="?show=unpaid">
		<span class="eyebrow">Outstanding</span>
		<strong>{formatMoney(data.stats.outstanding)}</strong>
		<span class="ui-note">{plural(data.stats.unpaidCount, 'invoice')}</span>
	</a>
	<a class="ui-stat" href="?show=overdue">
		<span class="eyebrow">Overdue</span>
		<strong>{formatMoney(data.stats.overdue)}</strong>
		<span class="ui-note">{plural(data.stats.overdueCount, 'invoice')}</span>
	</a>
	<a class="ui-stat" href="?show=paid">
		<span class="eyebrow">Paid in {data.stats.year}</span>
		<strong>{formatMoney(data.stats.paidThisYear)}</strong>
		<span class="ui-note">{plural(data.stats.paidThisYearCount, 'invoice')}</span>
	</a>
</section>

<section class="ui-panel">
	<div class="ui-panel-head">
		<nav class="ui-chips" aria-label="Filter invoices">
			{#each filters as item (item.id)}
				<a
					class="ui-chip"
					class:active={filter.id === item.id}
					href={item.id === 'all' ? '/admin/invoices' : `?show=${item.id}`}
					data-sveltekit-noscroll
					data-sveltekit-replacestate
				>
					{item.label}
					<span class="ui-count">{data.invoices.filter(item.test).length}</span>
				</a>
			{/each}
		</nav>
	</div>

	{#if shown.length}
		<div class="ui-table-wrap">
			<table class="ui-table">
				<thead>
					<tr>
						<th>Number</th>
						<th>Bill to</th>
						<th>Issued</th>
						<th>Due</th>
						<th class="ui-num">Amount</th>
						<th>Status</th>
						<th class="ui-center">Paid</th>
						<th class="ui-shrink"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each shown as invoice (invoice.id)}
						<tr>
							<td>
								<a class="ui-title num" href="/admin/invoices/{invoice.id}">{invoice.number}</a>
							</td>
							<td>
								{invoice.billToName || '—'}
								{#if invoice.bookingTitle}
									<a class="ui-sub job" href="/admin/jobs/{invoice.bookingId}"
										>{invoice.bookingTitle}</a
									>
								{/if}
							</td>
							<td class="nowrap">{formatShortDay(invoice.issueDate)}</td>
							<td class="nowrap">{invoice.dueDate ? formatShortDay(invoice.dueDate) : '—'}</td>
							<td class="ui-num">{formatMoney(invoice.total)}</td>
							<td><StateBadge state={invoice.state} /></td>
							<td class="ui-center">
								<FlagCheck
									on={invoice.state === 'paid'}
									label={invoice.state === 'paid' ? 'Mark as unpaid' : 'Mark as paid today'}
									busy={pending === invoice.id}
									onclick={() => togglePaid(invoice)}
								/>
							</td>
							<td class="ui-shrink">
								<div class="ui-row-actions">
									<a
										class="ui-icon-btn"
										href="/admin/api/invoices/{invoice.id}/pdf"
										download
										title="Download PDF"
										aria-label="Download invoice {invoice.number}"
									>
										<Download size={15} strokeWidth={1.5} />
									</a>
									<a
										class="ui-icon-btn"
										href="/admin/invoices/{invoice.id}"
										title="Edit"
										aria-label="Edit invoice {invoice.number}"
									>
										<Pencil size={15} strokeWidth={1.5} />
									</a>
									<button
										class="ui-icon-btn danger"
										onclick={() => remove(invoice)}
										title="Delete"
										aria-label="Delete invoice {invoice.number}"
									>
										<Trash2 size={15} strokeWidth={1.5} />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if data.invoices.length}
		<div class="ui-empty">
			<h3>Nothing here</h3>
			<p>No invoices match “{filter.label}”.</p>
		</div>
	{:else}
		<div class="ui-empty">
			<Receipt size={28} strokeWidth={1} />
			<h3>No invoices yet</h3>
			<p>Create one from a job, or start a blank invoice.</p>
			<div class="ui-inline">
				<a class="btn btn-quiet" href="/admin/jobs">Go to Jobs</a>
				<a class="btn btn-solid" href="/admin/invoices/new"><Plus size={14} /> New Invoice</a>
			</div>
		</div>
	{/if}
</section>

<style>
	.num {
		font-variant-numeric: lining-nums tabular-nums;
	}

	.job {
		text-decoration: none;
	}

	.job:hover {
		color: var(--text);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.nowrap {
		white-space: nowrap;
	}
</style>
