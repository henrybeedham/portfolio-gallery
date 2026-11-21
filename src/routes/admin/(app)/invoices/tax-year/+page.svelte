<script lang="ts">
	import { goto } from '$app/navigation';
	import Download from '@lucide/svelte/icons/download';
	import BackLink from '#lib/components/admin/BackLink.svelte';
	import { formatMoney } from '#lib/money.js';
	import { formatShortDay, invoiceLabel } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const bases = [
		{ id: 'paid', label: 'Paid in the year' },
		{ id: 'issued', label: 'Issued in the year' }
	];

	const query = (year: number, basis: string) => `?year=${year}&basis=${basis}`;
	const csvHref = $derived(`/admin/api/invoices/tax-year${query(data.year, data.basis)}`);
</script>

<svelte:head>
	<title>Tax year {data.label} — {data.settings.siteTitle}</title>
</svelte:head>

<BackLink list="invoices" label="Invoices" />

<header class="ui-head head">
	<div>
		<p class="eyebrow">Invoices</p>
		<h1>Tax year {data.label}</h1>
		<p class="muted intro">
			6 April {data.year} to 5 April {data.year + 1}. “Paid in the year” is the cash basis, which
			most sole traders use for Self Assessment; “Issued in the year” goes by invoice date instead.
			Drafts are left out.
		</p>
	</div>
	<div class="ui-actions">
		<a class="btn btn-solid" href={csvHref} download><Download size={14} /> Download CSV</a>
	</div>
</header>

<section class="ui-stats">
	<div class="ui-stat">
		<span class="eyebrow">Invoices</span>
		<strong>{data.invoices.length}</strong>
	</div>
	<div class="ui-stat">
		<span class="eyebrow">{data.basis === 'paid' ? 'Received' : 'Invoiced'}</span>
		<strong>{formatMoney(data.total)}</strong>
	</div>
	{#if data.basis === 'issued'}
		<div class="ui-stat">
			<span class="eyebrow">Still unpaid</span>
			<strong>{formatMoney(data.unpaid)}</strong>
		</div>
	{/if}
</section>

<section class="ui-panel">
	<div class="ui-panel-head">
		<nav class="ui-chips" aria-label="Count invoices by">
			{#each bases as basis (basis.id)}
				<a
					class="ui-chip"
					class:active={data.basis === basis.id}
					href={query(data.year, basis.id)}
					data-sveltekit-noscroll
					data-sveltekit-replacestate
				>
					{basis.label}
				</a>
			{/each}
		</nav>
		<select
			class="select year"
			aria-label="Tax year"
			value={String(data.year)}
			onchange={(event) =>
				goto(query(Number(event.currentTarget.value), data.basis), {
					replace: true,
					reset: false
				})}
		>
			{#each data.years as year (year.value)}
				<option value={String(year.value)}>{year.label}</option>
			{/each}
		</select>
	</div>

	{#if data.invoices.length}
		<div class="ui-table-wrap">
			<table class="ui-table">
				<thead>
					<tr>
						<th>Invoice</th>
						<th>Client</th>
						<th>Issued</th>
						<th>Paid</th>
						<th class="ui-num">Amount</th>
					</tr>
				</thead>
				<tbody>
					{#each data.invoices as invoice (invoice.id)}
						<tr>
							<td>
								<a class="ui-title" href="/admin/invoices/{invoice.id}">
									{invoiceLabel(invoice.number)}
								</a>
								{#if invoice.jobs}<span class="ui-sub">{invoice.jobs}</span>{/if}
							</td>
							<td>{invoice.client || '—'}</td>
							<td class="nowrap">{formatShortDay(invoice.issueDate)}</td>
							<td class="nowrap">{invoice.paidAt ? formatShortDay(invoice.paidAt) : '—'}</td>
							<td class="ui-num">{formatMoney(invoice.total)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="ui-empty">
			<h3>Nothing in {data.label}</h3>
			<p>No invoices were {data.basis === 'paid' ? 'paid' : 'issued'} in this tax year.</p>
		</div>
	{/if}
</section>

<style>
	.head {
		margin-top: 1.5rem;
	}

	.intro {
		max-width: 62ch;
		margin-top: 0.75rem;
		line-height: 1.7;
	}

	.year {
		width: auto;
		min-height: 36px;
		padding-block: 0.35rem;
		font-size: 0.88rem;
	}

	.nowrap {
		white-space: nowrap;
	}
</style>
