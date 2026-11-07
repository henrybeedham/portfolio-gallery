<script lang="ts" module>
	import type { BookingStatus, InvoiceDocument } from '#lib/types.js';

	export interface EditorJob {
		id: number;
		title: string;
		client: string;
		billingAddressId: number | null;
		startsAt: string | null;
		hours: number;
		rate: number;
		status: BookingStatus;
	}

	export interface EditorInvoice extends InvoiceDocument {
		bookingId: number | null;
		billingAddressId: number | null;
	}
</script>

<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import ThemePicker from './ThemePicker.svelte';
	import Toggle from './Toggle.svelte';
	import { api, feedback } from './feedback.svelte.js';
	import { formatMoney, itemsTotal, lineAmount, moneyInput, parseMoney } from '#lib/money.js';
	import type { BillingAddress, InvoiceSettings, ThemeSummary } from '#lib/types.js';
	import { formatJobDate, todayIso } from '#lib/utils.js';

	interface Props {
		mode: 'create' | 'edit';
		invoiceId?: number;
		initial: EditorInvoice;
		addresses: BillingAddress[];
		jobs: EditorJob[];
		clients: { client: string; billingAddressId: number | null }[];
		themes: ThemeSummary[];
		settings: InvoiceSettings;
		/** Called after a successful save in edit mode. */
		onsaved?: () => void;
	}

	let { mode, invoiceId, initial, addresses, jobs, clients, themes, settings, onsaved }: Props =
		$props();

	const start = untrack(() => initial);
	let key = 0;

	let bookingId = $state(start.bookingId ? String(start.bookingId) : '');
	let billingAddressId = $state<number | null>(start.billingAddressId);
	let addressTouched = $state(untrack(() => mode === 'edit'));
	let issueDate = $state(start.issueDate);
	let dueDate = $state(start.dueDate ?? '');
	let billToName = $state(start.billToName);
	let billToAddress = $state(start.billToAddress);
	let sender = $state({ ...start.sender });
	let paymentDetails = $state(start.paymentDetails);
	let notes = $state(start.notes);
	let style = $state(start.style);
	let paid = $state(!!start.paidAt);
	let paidAt = $state(start.paidAt ?? todayIso());
	let items = $state(
		start.items.map((item) => ({
			key: key++,
			description: item.description,
			quantity: String(item.quantity),
			rate: moneyInput(item.rate)
		}))
	);
	let saving = $state(false);

	const payload = $derived({
		number: start.number,
		bookingId: bookingId ? Number(bookingId) : null,
		billingAddressId,
		issueDate,
		dueDate: dueDate || null,
		billToName,
		billToAddress,
		sender,
		paymentDetails,
		notes,
		items: items.map((item) => ({
			description: item.description,
			quantity: Number(item.quantity) || 0,
			rate: parseMoney(item.rate) ?? 0
		})),
		style,
		paidAt: paid ? paidAt || todayIso() : null
	});
	const json = $derived(JSON.stringify(payload));
	let savedJson = $state(untrack(() => (mode === 'edit' ? json : '')));
	const dirty = $derived(json !== savedJson);
	const total = $derived(itemsTotal(payload.items));

	// ---- billing address -------------------------------------------------

	function addressText(address: BillingAddress) {
		return [address.organisation, address.address].filter((part) => part.trim()).join('\n');
	}

	function applyAddress(id: number | null) {
		billingAddressId = id;
		const address = addresses.find((a) => a.id === id);
		if (address) billToAddress = addressText(address);
	}

	function onclient() {
		if (addressTouched) return;
		const known = clients.find((c) => c.client.toLowerCase() === billToName.trim().toLowerCase());
		if (known?.billingAddressId) applyAddress(known.billingAddressId);
	}

	/** Filling a new invoice from a job; existing invoices are only re-linked. */
	function onjob() {
		const job = jobs.find((j) => String(j.id) === bookingId);
		if (!job || mode === 'edit') return;
		billToName = job.client || job.title;
		if (job.billingAddressId) applyAddress(job.billingAddressId);
		if (items.length === 1) {
			items[0].quantity = String(job.hours || 1);
			items[0].rate = moneyInput(job.rate || settings.hourlyRate);
		}
		const shootDay = job.startsAt?.slice(0, 10);
		if (settings.dueOnShootDate && shootDay && shootDay >= issueDate) dueDate = shootDay;
	}

	// ---- items -------------------------------------------------------------

	function addItem() {
		items.push({
			key: key++,
			description: settings.itemDescription,
			quantity: '1',
			rate: moneyInput(settings.hourlyRate)
		});
	}

	function removeItem(itemKey: number) {
		items = items.filter((item) => item.key !== itemKey);
	}

	function resetSender() {
		sender = { ...settings.sender };
		paymentDetails = settings.paymentDetails;
		feedback.toast('Filled in from your invoice settings', 'info');
	}

	// ---- live preview ------------------------------------------------------
	// Two frames: the next preview loads in the hidden one and is swapped in when ready, so the
	// visible PDF never flashes blank while you type.

	let frames = $state<[string | null, string | null]>([null, null]);
	let active = $state(0);
	let previewing = $state(false);
	let previewError = $state<string | null>(null);
	let sequence = 0;

	async function refresh(body: string) {
		const n = ++sequence;
		previewing = true;
		try {
			const response = await fetch('/admin/api/invoices/preview', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body
			});
			const data = await response.json().catch(() => ({}));
			if (n !== sequence) return;
			if (!response.ok) {
				previewError = data?.message ?? 'The preview could not be drawn.';
				previewing = false;
				return;
			}
			previewError = null;
			const next = active === 0 ? 1 : 0;
			frames[next] = `${data.url}#toolbar=0&navpanes=0&view=FitH`;
		} catch {
			if (n === sequence) {
				previewError = 'The preview could not be drawn.';
				previewing = false;
			}
		}
	}

	function onframeload(index: number) {
		if (index !== active && frames[index]) {
			active = index;
			previewing = false;
		}
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const body = json;
		const first = untrack(() => !frames[0] && !frames[1]);
		clearTimeout(timer);
		timer = setTimeout(() => refresh(body), first ? 0 : 450);
	});
	onDestroy(() => clearTimeout(timer));

	// ---- saving --------------------------------------------------------------

	export async function save(): Promise<boolean> {
		saving = true;
		try {
			if (mode === 'create') {
				const result = await api<{ id: number; number: string }>('/admin/api/invoices', payload);
				savedJson = json;
				feedback.toast(`Invoice ${result.number} created`);
				await goto(`/admin/invoices/${result.id}`);
			} else {
				await api(`/admin/api/invoices/${invoiceId}`, { action: 'save', invoice: payload });
				savedJson = json;
				feedback.toast('Invoice saved');
				onsaved?.();
			}
			return true;
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
			return false;
		} finally {
			saving = false;
		}
	}

	export function isDirty() {
		return dirty;
	}
</script>

<div class="editor">
	<div class="form">
		<section class="ui-card">
			<div class="ui-card-head">
				<h2>Bill to</h2>
			</div>
			<div class="field">
				<label for="job">Job <span class="ui-optional">optional</span></label>
				<select id="job" class="select" bind:value={bookingId} onchange={onjob}>
					<option value="">Not linked to a job</option>
					{#each jobs.filter((j) => j.status !== 'cancelled' || String(j.id) === bookingId) as job (job.id)}
						{@const when = formatJobDate(job.startsAt)}
						<option value={String(job.id)}>{job.title}{when.day ? ` — ${when.day}` : ''}</option>
					{/each}
				</select>
				{#if mode === 'create'}<p class="hint">
						Choosing a job fills in the client, hours and rate.
					</p>{/if}
			</div>
			<div class="field">
				<label for="bill-name">Client</label>
				<input
					id="bill-name"
					class="input"
					bind:value={billToName}
					oninput={onclient}
					list="invoice-clients"
					autocomplete="off"
					placeholder="Contemporary Choir"
				/>
				<datalist id="invoice-clients">
					{#each clients as item (item.client)}<option value={item.client}></option>{/each}
				</datalist>
			</div>
			<div class="field">
				<span class="label">Address</span>
				<div class="ui-chips" role="radiogroup" aria-label="Saved address">
					{#each addresses as address (address.id)}
						<button
							type="button"
							class="ui-chip"
							class:active={billingAddressId === address.id}
							role="radio"
							aria-checked={billingAddressId === address.id}
							title={address.organisation}
							onclick={() => {
								addressTouched = true;
								applyAddress(address.id);
							}}>{address.label}</button
						>
					{/each}
					<button
						type="button"
						class="ui-chip"
						class:active={billingAddressId === null}
						role="radio"
						aria-checked={billingAddressId === null}
						onclick={() => {
							addressTouched = true;
							billingAddressId = null;
						}}>Other</button
					>
				</div>
				<textarea
					class="textarea ui-textarea-short"
					rows="5"
					bind:value={billToAddress}
					oninput={() => (addressTouched = true)}
					aria-label="Bill-to address"
					placeholder="Organisation&#10;Street&#10;Town&#10;Postcode"></textarea>
			</div>
		</section>

		<section class="ui-card">
			<div class="ui-card-head">
				<h2>Details</h2>
			</div>
			<div class="ui-grid-2">
				<div class="field">
					<label for="issue">Date</label>
					<input id="issue" class="input" type="date" bind:value={issueDate} required />
				</div>
				<div class="field">
					<label for="due">Due date <span class="ui-optional">optional</span></label>
					<input id="due" class="input" type="date" bind:value={dueDate} />
				</div>
			</div>

			<div class="field">
				<span class="label">Items</span>
				<div class="items">
					<div class="item item-head" aria-hidden="true">
						<span>Description</span><span>Qty</span><span>Rate</span><span class="amount"
							>Amount</span
						><span></span>
					</div>
					{#each items as item, i (item.key)}
						<div class="item">
							<input
								class="input desc"
								bind:value={item.description}
								aria-label="Item {i + 1} description"
							/>
							<input
								class="input"
								bind:value={item.quantity}
								inputmode="decimal"
								aria-label="Item {i + 1} quantity"
							/>
							<div class="ui-money-input">
								<input
									class="input"
									bind:value={item.rate}
									inputmode="decimal"
									aria-label="Item {i + 1} rate"
								/>
							</div>
							<span class="amount">
								{formatMoney(
									lineAmount({
										quantity: Number(item.quantity) || 0,
										rate: parseMoney(item.rate) ?? 0
									})
								)}
							</span>
							<button
								type="button"
								class="ui-icon-btn danger"
								onclick={() => removeItem(item.key)}
								disabled={items.length === 1}
								aria-label="Remove item {i + 1}"
								title="Remove"
							>
								<X size={15} strokeWidth={1.5} />
							</button>
						</div>
					{/each}
				</div>
				<div class="items-foot">
					<button type="button" class="link" onclick={addItem}><Plus size={13} /> Add item</button>
					<p class="total"><span class="label">Total</span> {formatMoney(total)}</p>
				</div>
			</div>

			<div class="field">
				<label for="notes">Notes <span class="ui-optional">optional</span></label>
				<textarea id="notes" class="textarea ui-textarea-short" rows="2" bind:value={notes}
				></textarea>
			</div>
		</section>

		<section class="ui-card">
			<div class="ui-card-head head-row">
				<div>
					<h2>Your details</h2>
					<p class="hint">Saved on this invoice, so changing your defaults later won’t alter it.</p>
				</div>
				<button type="button" class="link" onclick={resetSender}>
					<RotateCcw size={13} /> Use defaults
				</button>
			</div>
			<div class="ui-grid-2">
				<div class="field">
					<label for="s-name">Name</label>
					<input id="s-name" class="input" bind:value={sender.name} />
				</div>
				<div class="field">
					<label for="s-email">Email</label>
					<input id="s-email" class="input" type="email" bind:value={sender.email} />
				</div>
			</div>
			<div class="ui-grid-2">
				<div class="field">
					<label for="s-address">Address</label>
					<textarea
						id="s-address"
						class="textarea ui-textarea-short"
						rows="3"
						bind:value={sender.address}></textarea>
				</div>
				<div class="field">
					<label for="s-phone">Phone</label>
					<input id="s-phone" class="input" type="tel" bind:value={sender.phone} />
				</div>
			</div>
			<div class="field">
				<label for="payment">Payment information</label>
				<textarea
					id="payment"
					class="textarea ui-textarea-short"
					rows="3"
					bind:value={paymentDetails}
					placeholder="Name: …&#10;Account number: …&#10;Sort code: …"></textarea>
			</div>
		</section>

		<section class="ui-card">
			<div class="ui-card-head">
				<h2>Style &amp; payment</h2>
			</div>
			<div class="field">
				<span class="label">Style</span>
				<ThemePicker {themes} name="invoice-style" bind:value={style} compact />
			</div>
			<div class="paid">
				<Toggle
					label="Paid"
					description="Shows a paid stamp and a balance of £0.00."
					bind:checked={paid}
				/>
				{#if paid}
					<input class="input paid-date" type="date" bind:value={paidAt} aria-label="Date paid" />
				{/if}
			</div>
		</section>

		<div class="submit">
			{#if dirty && mode === 'edit'}<span class="unsaved">Unsaved changes</span>{/if}
			<button class="btn btn-solid" disabled={saving || (mode === 'edit' && !dirty)} onclick={save}>
				{#if saving}<span class="spinner"></span>{/if}
				{mode === 'create' ? 'Create Invoice' : 'Save Changes'}
			</button>
		</div>
	</div>

	<aside class="preview" aria-label="Preview">
		<div class="preview-head">
			<span class="eyebrow">Preview</span>
			{#if previewing}<span class="spinner subtle"></span>{/if}
		</div>
		<div class="sheet">
			{#each frames as src, index (index)}
				{#if src}
					<iframe
						title="Invoice preview"
						{src}
						class:shown={index === active}
						onload={() => onframeload(index)}
						inert={index !== active}
					></iframe>
				{/if}
			{/each}
			{#if previewError}<p class="preview-error">{previewError}</p>{/if}
		</div>
	</aside>
</div>

<style>
	.editor {
		display: grid;
		gap: 1.5rem;
		align-items: start;
	}

	@media (min-width: 1240px) {
		.editor {
			grid-template-columns: minmax(0, 640px) minmax(380px, 1fr);
		}

		.preview {
			position: sticky;
			top: 1.5rem;
		}
	}

	.form {
		display: grid;
		gap: 1.5rem;
		min-width: 0;
	}

	.head-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.items {
		display: grid;
		gap: 0.5rem;
	}

	.item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 64px 104px 84px 34px;
		gap: 0.5rem;
		align-items: center;
	}

	.item-head span {
		font-size: 0.62rem;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.amount {
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
	}

	@media (max-width: 560px) {
		.item {
			grid-template-columns: 64px minmax(0, 1fr) 84px 34px;
		}

		.item .desc {
			grid-column: 1 / -1;
		}

		.item-head {
			display: none;
		}
	}

	.items-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.total {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		font-family: var(--font-serif);
		font-size: 1.5rem;
		font-variant-numeric: lining-nums;
	}

	.paid {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.paid-date {
		width: auto;
	}

	.submit {
		position: sticky;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 1rem;
		padding-block: 1rem;
		background: linear-gradient(to top, var(--bg) 70%, transparent);
	}

	.unsaved {
		font-size: 0.8rem;
		color: var(--warning);
	}

	.preview-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.75rem;
	}

	.sheet {
		position: relative;
		aspect-ratio: 210 / 297;
		width: 100%;
		max-height: calc(100svh - 6rem);
		border: 1px solid var(--border);
		background: var(--placeholder);
	}

	@media (min-width: 1240px) {
		.sheet {
			max-width: calc((100svh - 6rem) * 210 / 297);
		}
	}

	iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s var(--ease);
	}

	iframe.shown {
		opacity: 1;
		pointer-events: auto;
	}

	.preview-error {
		position: absolute;
		inset: auto 1rem 1rem;
		padding: 0.75rem 1rem;
		background: var(--danger-soft);
		border: 1px solid var(--danger);
		color: var(--danger);
		font-size: 0.85rem;
	}
</style>
