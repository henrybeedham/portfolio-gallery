<script lang="ts">
	import BackLink from '#lib/components/admin/BackLink.svelte';
	import { goto } from '$app/navigation';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import StateBadge from '#lib/components/admin/StateBadge.svelte';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { parseSheet, type ImportRow } from '#lib/booking-import.js';
	import { formatHours, formatMoney } from '#lib/money.js';
	import { formatJobDate } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	interface Row extends ImportRow {
		include: boolean;
		duplicate: boolean;
	}

	let text = $state('');
	let rows = $state<Row[]>([]);
	let errors = $state<string[]>([]);
	let parsed = $state(false);
	let importing = $state(false);

	const selected = $derived(rows.filter((row) => row.include));

	function addressFor(client: string) {
		const known = data.clients.find((c) => c.client.toLowerCase() === client.trim().toLowerCase());
		return known?.billingAddressId ?? null;
	}

	function preview() {
		const result = parseSheet(text);
		errors = result.errors;
		const existing = new Set(data.existing);
		rows = result.rows.map((row) => {
			const duplicate = existing.has(`${row.title.toLowerCase()}|${row.startsAt?.slice(0, 10) ?? ''}`);
			return {
				...row,
				billingAddressId: addressFor(row.client),
				duplicate,
				include: !duplicate && !row.delivered && row.status !== 'cancelled'
			};
		});
		parsed = true;
	}

	async function run() {
		importing = true;
		try {
			const result = await api<{ imported: number; skipped: number }>(
				'/admin/api/bookings/import',
				{ rows: selected.map(({ include: _i, duplicate: _d, line: _l, ...row }) => row) }
			);
			feedback.toast(
				`Imported ${result.imported} job${result.imported === 1 ? '' : 's'}` +
					(result.skipped ? ` (${result.skipped} already here)` : '')
			);
			await goto('/admin/jobs');
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			importing = false;
		}
	}
</script>

<svelte:head>
	<title>Import jobs — {data.settings.siteTitle}</title>
</svelte:head>

<BackLink list="jobs" label="Jobs" />

<header class="head">
	<p class="eyebrow">Jobs</p>
	<h1>Import from a spreadsheet</h1>
	<p class="muted intro">
		In Google Sheets, select your jobs <strong>including the header row</strong>, copy, and paste
		them below. Columns are matched by name: Job description, Invoice #, Location, Mine, Date and
		time, Hours, Rate, Paid and Delivered. “Mine” becomes the booking status (yes → confirmed,
		maybe → tentative, no → cancelled).
	</p>
	<p class="muted intro">
		Jobs don’t hold money, so each row’s fee goes onto an invoice for the job. A row that’s paid or
		has an invoice number becomes an imported record with that number. A fee that wasn’t invoiced
		becomes a draft, ready to send.
	</p>
</header>

<section class="ui-card paste">
	<div class="field">
		<label for="sheet">Spreadsheet rows</label>
		<textarea
			id="sheet"
			class="textarea mono"
			rows="8"
			bind:value={text}
			placeholder="Job #	Invoice #	Job description	Location	Mine	Date and time	…"
		></textarea>
	</div>
	<div class="ui-inline">
		<button class="btn btn-quiet" onclick={preview} disabled={!text.trim()}>
			<ClipboardPaste size={14} /> Preview
		</button>
	</div>
	{#each errors as error, i (i)}<p class="alert alert-error">{error}</p>{/each}
</section>

{#if parsed && rows.length}
	<section class="ui-panel results">
		<div class="ui-panel-head">
			<div>
				<h2>{rows.length} jobs found</h2>
				<p class="hint">
					Delivered and cancelled jobs are left unticked. Check each client and choose AU, Guild or Other,
					so invoices fill themselves in.
				</p>
			</div>
			<button class="btn btn-solid" disabled={!selected.length || importing} onclick={run}>
				{#if importing}<span class="spinner"></span>{/if}
				Import {selected.length} job{selected.length === 1 ? '' : 's'}
			</button>
		</div>
		<div class="ui-table-wrap">
			<table class="ui-table">
				<thead>
					<tr>
						<th class="ui-shrink"><span class="visually-hidden">Import</span></th>
						<th>Job</th>
						<th>Date</th>
						<th>Client</th>
						<th>Billing</th>
						<th class="ui-num">Fee</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.line)}
						{@const when = formatJobDate(row.startsAt)}
						<tr class:ui-faded={!row.include}>
							<td class="ui-shrink">
								<input
									type="checkbox"
									bind:checked={row.include}
									aria-label="Import {row.title}"
								/>
							</td>
							<td>
								<span class="ui-title">{row.title}</span>
								<span class="ui-sub">
									{[row.location, row.legacyInvoices && `Invoice ${row.legacyInvoices}`]
										.filter(Boolean)
										.join(' · ')}
								</span>
							</td>
							<td class="nowrap">
								{when.day || 'TBC'}
								{#if when.time}<span class="ui-sub">{when.time}</span>{/if}
							</td>
							<td>
								<input
									class="input compact"
									bind:value={row.client}
									list="import-clients"
									aria-label="Client for {row.title}"
								/>
							</td>
							<td>
								<select
									class="select compact"
									bind:value={row.billingAddressId}
									aria-label="Billing address for {row.title}"
								>
									<option value={null}>Other</option>
									{#each data.addresses as address (address.id)}
										<option value={address.id}>{address.label}</option>
									{/each}
								</select>
							</td>
							<td class="ui-num">
								{formatMoney(Math.round(row.hours * row.rate))}
								<span class="ui-sub">{formatHours(row.hours)} × {formatMoney(row.rate)}</span>
								{#if row.paid || row.legacyInvoices}
									<span class="ui-sub">Imported record</span>
								{:else if row.hours * row.rate > 0 && row.status !== 'cancelled'}
									<span class="ui-sub">Draft invoice</span>
								{/if}
							</td>
							<td>
								<div class="ui-badges">
									{#if row.duplicate}<span class="ui-badge warn">Already here</span>{/if}
									{#if row.status !== 'confirmed'}<StateBadge state={row.status} />{/if}
									{#if row.paid}<span class="ui-badge ok">Paid</span>{/if}
									{#if row.delivered}<span class="ui-badge ok">Delivered</span>{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<datalist id="import-clients">
			{#each data.clients as item (item.client)}<option value={item.client}></option>{/each}
		</datalist>
	</section>
{/if}

<style>
	.head {
		margin: 1.5rem 0 2rem;
		max-width: 760px;
	}

	h1 {
		font-size: clamp(2.2rem, 4vw, 3rem);
		margin: 0.5rem 0 1rem;
	}

	.intro {
		line-height: 1.7;
	}

	.intro + .intro {
		margin-top: 0.75rem;
	}

	.paste {
		max-width: 760px;
	}

	.mono {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.8rem;
		white-space: pre;
	}

	.results {
		margin-top: 1.5rem;
	}

	.results .hint {
		margin-top: 0.35rem;
	}

	.nowrap {
		white-space: nowrap;
	}

	.compact {
		min-height: 36px;
		padding-block: 0.35rem;
		font-size: 0.86rem;
		min-width: 140px;
	}

	input[type='checkbox'] {
		width: 16px;
		height: 16px;
		accent-color: var(--highlight, var(--text));
	}
</style>
