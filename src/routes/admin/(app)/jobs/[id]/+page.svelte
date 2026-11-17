<script lang="ts">
	import { listUrl } from '#lib/components/admin/list-memory.js';
	import BackLink from '#lib/components/admin/BackLink.svelte';
	import { goto, invalidate } from '$app/navigation';
	import FilePlus from '@lucide/svelte/icons/file-plus';
	import Download from '@lucide/svelte/icons/download';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Images from '@lucide/svelte/icons/images';
	import BookingForm from '#lib/components/admin/BookingForm.svelte';
	import StateBadge from '#lib/components/admin/StateBadge.svelte';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { formatMoney, moneyInput, parseMoney } from '#lib/money.js';
	import { formatJobDate, formatShortDay, invoiceLabel, todayIso } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const booking = $derived(data.booking);
	const when = $derived(formatJobDate(booking.startsAt, booking.endsAt));
	const unlinked = $derived(
		data.albums.filter((album) => !booking.albums.some((linked) => linked.id === album.id))
	);
	const unlinkedInvoices = $derived(
		data.invoices.filter((option) => !booking.invoices.some((linked) => linked.id === option.id))
	);
	let albumToLink = $state('');
	let invoiceToLink = $state('');
	let busy = $state(false);

	function album(action: 'link-album' | 'unlink-album', albumId: number) {
		return update({ action, albumId }, action === 'link-album' ? 'Album linked' : 'Album unlinked');
	}

	function linkedInvoice(action: 'link-invoice' | 'unlink-invoice', invoiceId: number) {
		return update(
			{ action, invoiceId },
			action === 'link-invoice' ? 'Invoice linked' : 'Invoice unlinked'
		);
	}

	async function update(body: Record<string, unknown>, message: string) {
		busy = true;
		try {
			await api(`/admin/api/bookings/${booking.id}`, body);
			await invalidate('admin:booking');
			albumToLink = '';
			invoiceToLink = '';
			feedback.toast(message);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			busy = false;
		}
	}

	const draft = $derived(booking.invoices.find((invoice) => invoice.state === 'draft'));
	let external = $state<{ number: string; date: string; amount: string; paidAt: string } | null>(
		null
	);
	let recording = $state(false);

	function startExternal() {
		const today = todayIso();
		const shootDay = booking.startsAt?.slice(0, 10);
		external = {
			number: '',
			date: shootDay && shootDay < today ? shootDay : today,
			amount: draft ? moneyInput(draft.total) : '',
			paidAt: ''
		};
	}

	async function recordExternal(event: SubmitEvent) {
		event.preventDefault();
		if (!external) return;
		const given = external.amount.trim();
		const amount = given ? parseMoney(given) : null;
		if (given && amount === null) {
			feedback.toast('Check the amount.', 'error');
			return;
		}
		recording = true;
		try {
			await api(`/admin/api/bookings/${booking.id}`, {
				action: 'record-external-invoice',
				number: external.number,
				date: external.date,
				amount,
				paidAt: external.paidAt
			});
			await invalidate('admin:booking');
			external = null;
			feedback.toast('Invoice recorded');
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			recording = false;
		}
	}

	async function remove() {
		const ok = await feedback.confirm({
			title: `Delete “${booking.title}”?`,
			message: booking.invoices.length
				? 'The job is deleted. Its invoices are kept, but they won’t be linked to a job any more.'
				: 'This permanently deletes the job.',
			confirmLabel: 'Delete job',
			danger: true
		});
		if (!ok) return;
		try {
			await api(`/admin/api/bookings/${booking.id}`, undefined, 'DELETE');
			feedback.toast(`Deleted “${booking.title}”`);
			await goto(listUrl('jobs'));
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		}
	}
</script>

<svelte:head>
	<title>{booking.title} — Jobs</title>
</svelte:head>

{#key booking.id}
	<BackLink list="jobs" label="Jobs" />

	<header class="ui-head head">
		<div>
			<p class="eyebrow">
				{[when.day, when.time].filter(Boolean).join(' · ') || 'Date TBC'}
			</p>
			<h1>{booking.title}</h1>
			<div class="ui-badges badges">
				{#if booking.status !== 'confirmed'}<StateBadge state={booking.status} />{/if}
				<StateBadge state={booking.payment} />
				{#if booking.delivered}<span class="ui-badge ok">Delivered</span>{/if}
				{#if booking.invoices.length}
					<span class="subtle">{formatMoney(booking.total)}</span>
				{/if}
			</div>
		</div>
		<div class="ui-actions">
			<a class="btn btn-sm btn-quiet" href="/admin/invoices/new?job={booking.id}">
				<FilePlus size={13} /> New invoice
			</a>
			<button class="btn btn-sm btn-danger" onclick={remove}><Trash2 size={13} /> Delete</button>
		</div>
	</header>

	<div class="layout">
		<div class="main">
			<BookingForm
				action="?/save"
				initial={data.initial}
				addresses={data.addresses}
				clients={data.clients}
				error={form?.error ?? null}
				errorField={form?.field ?? null}
			/>
		</div>

		<aside class="aside">
			<section class="ui-panel">
				<div class="ui-panel-head">
					<h2>Invoices</h2>
					<a class="btn btn-sm btn-quiet" href="/admin/invoices/new?job={booking.id}">
						<Plus size={13} /> New
					</a>
				</div>
				{#if booking.invoices.length}
					<ul class="list">
						{#each booking.invoices as invoice (invoice.id)}
							<li>
								<div>
									<a class="ui-title" href="/admin/invoices/{invoice.id}"
										>{invoiceLabel(invoice.number)}</a
									>
									<span class="ui-sub">
										{formatMoney(invoice.total)}
										{#if invoice.state === 'draft'}
											· not sent yet
										{:else if invoice.paidAt}
											· paid {formatShortDay(invoice.paidAt)}
										{:else if invoice.dueDate}
											· due {formatShortDay(invoice.dueDate)}
										{/if}
										{#if invoice.imported}· imported{/if}
									</span>
									{#if invoice.sharedWith.length}
										<span class="ui-sub">
											{formatMoney(invoice.share)} counts here · shared with
											{#each invoice.sharedWith as other, i (other.id)}{i ? ', ' : ''}<a
													class="shared"
													href="/admin/jobs/{other.id}">{other.title}</a
												>{/each}
										</span>
									{/if}
								</div>
								<div class="ui-row-actions">
									<StateBadge state={invoice.state} />
									{#if invoice.state !== 'draft' && !invoice.imported}
										<a
											class="ui-icon-btn"
											href="/admin/api/invoices/{invoice.id}/pdf"
											download
											title="Download PDF"
											aria-label="Download invoice {invoice.number}"
										>
											<Download size={15} strokeWidth={1.5} />
										</a>
									{/if}
									<button
										class="ui-icon-btn danger"
										onclick={() => linkedInvoice('unlink-invoice', invoice.id)}
										disabled={busy}
										title="Unlink invoice"
										aria-label="Unlink invoice {invoiceLabel(invoice.number)}"
									>
										<X size={15} strokeWidth={1.5} />
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty muted">
						No invoices yet. The fee lives on an invoice: start one and save it as a draft until you
						send it.
					</p>
				{/if}
				{#if unlinkedInvoices.length}
					<div class="link-row">
						<select class="select" bind:value={invoiceToLink} aria-label="Invoice to link">
							<option value="">Link an existing invoice…</option>
							{#each unlinkedInvoices as option (option.id)}
								<option value={String(option.id)}>
									{invoiceLabel(option.number)} — {option.billToName || 'No client'} — {formatMoney(
										option.total
									)}
								</option>
							{/each}
						</select>
						<button
							class="btn btn-sm btn-quiet"
							disabled={!invoiceToLink || busy}
							onclick={() => linkedInvoice('link-invoice', Number(invoiceToLink))}>Link</button
						>
					</div>
				{/if}
				<div class="elsewhere">
					{#if external}
						<form onsubmit={recordExternal}>
							<p class="hint">
								For an invoice you sent from another platform.
								{#if draft}This replaces draft {invoiceLabel(draft.number)}.{/if}
							</p>
							<div class="field">
								<label for="external-number"
									>Invoice number <span class="ui-optional">optional</span></label
								>
								<input
									id="external-number"
									class="input"
									maxlength="40"
									bind:value={external.number}
								/>
							</div>
							<div class="field">
								<label for="external-date">Date invoiced</label>
								<input
									id="external-date"
									class="input"
									type="date"
									required
									bind:value={external.date}
								/>
							</div>
							<div class="field">
								<label for="external-amount">Amount <span class="ui-optional">optional</span></label
								>
								<div class="ui-money-input">
									<input
										id="external-amount"
										class="input"
										inputmode="decimal"
										bind:value={external.amount}
									/>
								</div>
							</div>
							<div class="field">
								<label for="external-paid">Paid on <span class="ui-optional">optional</span></label>
								<input id="external-paid" class="input" type="date" bind:value={external.paidAt} />
								<p class="hint">Leave this blank if it’s still unpaid.</p>
							</div>
							<div class="ui-inline">
								<button class="btn btn-sm btn-solid" disabled={recording}>
									{#if recording}<span class="spinner"></span>{/if} Record Invoice
								</button>
								<button class="link" type="button" onclick={() => (external = null)}>Cancel</button>
							</div>
						</form>
					{:else}
						<button class="link" onclick={startExternal}>Invoiced Elsewhere</button>
					{/if}
				</div>
			</section>

			<section class="ui-panel">
				<div class="ui-panel-head">
					<h2>Albums</h2>
					<a class="btn btn-sm btn-quiet" href="/admin/albums/new?job={booking.id}">
						<Plus size={13} /> New
					</a>
				</div>
				{#if booking.albums.length}
					<ul class="list">
						{#each booking.albums as linked (linked.id)}
							<li>
								<div>
									<a class="ui-title" href="/admin/albums/{linked.id}">{linked.title}</a>
									<span class="ui-sub">/{linked.slug}</span>
								</div>
								<button
									class="ui-icon-btn danger"
									onclick={() => album('unlink-album', linked.id)}
									disabled={busy}
									title="Unlink album"
									aria-label="Unlink {linked.title}"
								>
									<X size={15} strokeWidth={1.5} />
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty muted">
						<Images size={16} strokeWidth={1.25} /> No album linked. Delivering without one is fine.
					</p>
				{/if}
				{#if unlinked.length}
					<div class="link-row">
						<select class="select" bind:value={albumToLink} aria-label="Album to link">
							<option value="">Link an existing album…</option>
							{#each unlinked as option (option.id)}
								<option value={String(option.id)}>{option.title}</option>
							{/each}
						</select>
						<button
							class="btn btn-sm btn-quiet"
							disabled={!albumToLink || busy}
							onclick={() => album('link-album', Number(albumToLink))}>Link</button
						>
					</div>
				{/if}
			</section>
		</aside>
	</div>
{/key}

<style>
	.head {
		margin-top: 1.5rem;
	}

	.badges {
		align-items: center;
		margin-top: 0.85rem;
	}

	.layout {
		display: grid;
		gap: 1.5rem;
		align-items: start;
	}

	@media (min-width: 1200px) {
		.layout {
			grid-template-columns: minmax(0, 760px) minmax(300px, 1fr);
		}

		.aside {
			position: sticky;
			top: 1.5rem;
		}
	}

	.aside {
		display: grid;
		gap: 1.5rem;
	}

	.aside :global(.ui-panel + .ui-panel) {
		margin-top: 0;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 1.5rem;
		border-bottom: 1px solid var(--border);
	}

	.list li:last-child {
		border-bottom: 0;
	}

	.list .ui-row-actions {
		align-items: center;
	}

	.empty {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1.25rem 1.5rem;
		font-size: 0.88rem;
	}

	.elsewhere {
		padding: 1rem 1.5rem 1.25rem;
		border-top: 1px solid var(--border);
	}

	.elsewhere form {
		display: grid;
		gap: 1rem;
	}

	.shared {
		color: inherit;
		text-underline-offset: 3px;
	}

	.link-row {
		display: flex;
		gap: 0.5rem;
		padding: 1rem 1.5rem 1.25rem;
		border-top: 1px solid var(--border);
	}

	.link-row .select {
		min-height: 36px;
		padding-block: 0.4rem;
		font-size: 0.88rem;
	}
</style>
