<script lang="ts" module>
	export interface BookingFormValues {
		title: string;
		client: string;
		billingAddressId: number | null;
		location: string;
		date: string;
		time: string;
		hours: string;
		rate: string;
		status: import('#lib/types.js').BookingStatus;
		shot: boolean;
		delivered: boolean;
		paid: boolean;
		legacyInvoices: string;
		notes: string;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Toggle from './Toggle.svelte';
	import { feedback } from './feedback.svelte.js';
	import { parseHours } from '#lib/booking-import.js';
	import { formatMoney, parseMoney } from '#lib/money.js';
	import type { BillingAddress, BookingStatus } from '#lib/types.js';

	interface Props {
		initial: BookingFormValues;
		addresses: BillingAddress[];
		clients: { client: string; billingAddressId: number | null }[];
		/** The job has invoices here, so “paid” comes from them. */
		hasInvoices?: boolean;
		action?: string;
		submitLabel?: string;
		error?: string | null;
		errorField?: string | null;
	}

	let {
		initial,
		addresses,
		clients,
		hasInvoices = false,
		action = '',
		submitLabel = 'Save Job',
		error = null,
		errorField = null
	}: Props = $props();

	const start = untrack(() => initial);
	let title = $state(start.title);
	let client = $state(start.client);
	let billingAddressId = $state<number | null>(start.billingAddressId);
	let addressTouched = $state(start.billingAddressId !== null);
	let location = $state(start.location);
	let date = $state(start.date);
	let time = $state(start.time);
	let hours = $state(start.hours);
	let rate = $state(start.rate);
	let status = $state<BookingStatus>(start.status);
	let shot = $state(start.shot);
	let delivered = $state(start.delivered);
	let paid = $state(start.paid);
	let saving = $state(false);

	const fee = $derived.by(() => {
		const h = parseHours(hours);
		const r = parseMoney(rate);
		return h !== null && r !== null ? Math.round(h * r) : null;
	});

	const selectedAddress = $derived(addresses.find((a) => a.id === billingAddressId));

	/** Picks the address you used last time for this client, unless you've chosen one yourself. */
	function onclient() {
		if (addressTouched) return;
		const known = clients.find((c) => c.client.toLowerCase() === client.trim().toLowerCase());
		if (known?.billingAddressId && addresses.some((a) => a.id === known.billingAddressId)) {
			billingAddressId = known.billingAddressId;
		}
	}

	const statuses: { value: BookingStatus; label: string }[] = [
		{ value: 'confirmed', label: 'Confirmed' },
		{ value: 'tentative', label: 'Tentative' },
		{ value: 'cancelled', label: 'Cancelled' }
	];
</script>

<form
	method="POST"
	{action}
	class="form"
	use:enhance={() => {
		saving = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			saving = false;
			if (result.type === 'success' || result.type === 'redirect') feedback.toast('Job saved');
			else if (result.type === 'failure')
				feedback.toast(String(result.data?.error ?? 'Please check the form'), 'error');
			else if (result.type === 'error') feedback.toast('Something went wrong', 'error');
		};
	}}
>
	{#if error}<p class="alert alert-error">{error}</p>{/if}

	<section class="ui-card">
		<div class="ui-card-head">
			<h2>Job</h2>
		</div>
		<div class="field">
			<label for="title">Name</label>
			<input
				id="title"
				class="input"
				name="title"
				bind:value={title}
				placeholder="Boxing Christmas Dinner"
				required
				aria-invalid={errorField === 'title'}
			/>
		</div>
		<div class="ui-grid-2">
			<div class="field">
				<label for="date">Date <span class="ui-optional">optional</span></label>
				<input id="date" class="input" type="date" name="date" bind:value={date} />
			</div>
			<div class="field">
				<label for="time">Start time <span class="ui-optional">optional</span></label>
				<input id="time" class="input" type="time" name="time" bind:value={time} />
			</div>
		</div>
		<div class="ui-grid-3">
			<div class="field">
				<label for="hours">Hours</label>
				<input
					id="hours"
					class="input"
					name="hours"
					bind:value={hours}
					inputmode="decimal"
					placeholder="2.5"
					aria-invalid={errorField === 'hours'}
				/>
			</div>
			<div class="field">
				<label for="rate">Rate per hour</label>
				<div class="ui-money-input">
					<input
						id="rate"
						class="input"
						name="rate"
						bind:value={rate}
						inputmode="decimal"
						aria-invalid={errorField === 'rate'}
					/>
				</div>
			</div>
			<div class="field">
				<span class="label">Fee</span>
				<p class="fee">{fee === null ? '—' : formatMoney(fee)}</p>
			</div>
		</div>
		<div class="field">
			<label for="location">Location <span class="ui-optional">optional</span></label>
			<input
				id="location"
				class="input"
				name="location"
				bind:value={location}
				placeholder="Exeter Castle"
			/>
		</div>
	</section>

	<section class="ui-card">
		<div class="ui-card-head">
			<h2>Client</h2>
			<p class="hint">Used to fill in “Bill to” on this job’s invoices.</p>
		</div>
		<div class="field">
			<label for="client">Society or client</label>
			<input
				id="client"
				class="input"
				name="client"
				bind:value={client}
				oninput={onclient}
				list="client-suggestions"
				autocomplete="off"
				placeholder="Boxing"
			/>
			<datalist id="client-suggestions">
				{#each clients as item (item.client)}<option value={item.client}></option>{/each}
			</datalist>
		</div>
		<div class="field">
			<span class="label">Billing address</span>
			<div class="ui-chips" role="radiogroup" aria-label="Billing address">
				{#each addresses as address (address.id)}
					<label
						class="ui-chip"
						class:active={billingAddressId === address.id}
						title={address.organisation}
					>
						<input
							type="radio"
							class="visually-hidden"
							name="billing_address_id"
							value={address.id}
							checked={billingAddressId === address.id}
							onchange={() => {
								billingAddressId = address.id;
								addressTouched = true;
							}}
						/>
						{address.label}
					</label>
				{/each}
				<label class="ui-chip" class:active={billingAddressId === null}>
					<input
						type="radio"
						class="visually-hidden"
						name="billing_address_id"
						value=""
						checked={billingAddressId === null}
						onchange={() => {
							billingAddressId = null;
							addressTouched = true;
						}}
					/>
					Other
				</label>
			</div>
			<p class="hint address">
				{#if selectedAddress}
					{selectedAddress.organisation}, {selectedAddress.address.split('\n').join(', ')}
				{:else}
					Type the address on the invoice instead.
				{/if}
				<a href="/admin/invoices/settings#addresses">Edit saved addresses</a>
			</p>
		</div>
	</section>

	<section class="ui-card">
		<div class="ui-card-head">
			<h2>Progress</h2>
		</div>
		<div class="field">
			<span class="label">Booking</span>
			<div class="ui-chips" role="radiogroup" aria-label="Booking status">
				{#each statuses as item (item.value)}
					<label class="ui-chip" class:active={status === item.value}>
						<input
							type="radio"
							class="visually-hidden"
							name="status"
							value={item.value}
							bind:group={status}
						/>
						{item.label}
					</label>
				{/each}
			</div>
		</div>
		<div class="toggles">
			<Toggle name="shot" label="Shot" bind:checked={shot} />
			<Toggle
				name="delivered"
				label="Delivered"
				description="Link the album below once it’s saved."
				bind:checked={delivered}
			/>
			{#if hasInvoices}
				<input type="hidden" name="paid" value={paid ? 'on' : ''} />
			{:else}
				<Toggle
					name="paid"
					label="Paid"
					description="For jobs paid without an invoice here. Once a job has invoices, they decide this."
					bind:checked={paid}
				/>
			{/if}
		</div>
		<div class="field">
			<label for="legacy">Earlier invoice numbers <span class="ui-optional">optional</span></label>
			<input
				id="legacy"
				class="input"
				name="legacy_invoices"
				value={start.legacyInvoices}
				placeholder="64017714"
			/>
			<p class="hint">
				Invoices sent before this system. New invoice numbers will never repeat them.
			</p>
		</div>
		<div class="field">
			<label for="notes">Notes <span class="ui-optional">optional</span></label>
			<textarea id="notes" class="textarea ui-textarea-short" name="notes" rows="3"
				>{start.notes}</textarea
			>
		</div>
	</section>

	<div class="submit">
		<button class="btn btn-solid" disabled={saving}>
			{#if saving}<span class="spinner"></span>{/if}
			{submitLabel}
		</button>
	</div>
</form>

<style>
	.form {
		display: grid;
		gap: 1.5rem;
	}

	.fee {
		min-height: 44px;
		display: flex;
		align-items: center;
		font-family: var(--font-serif);
		font-size: 1.4rem;
		font-variant-numeric: lining-nums;
	}

	.address a {
		margin-left: 0.4rem;
		color: var(--text-muted);
		text-underline-offset: 3px;
	}

	.toggles {
		display: grid;
		gap: 1rem;
	}

	.submit {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		padding-block: 1rem;
		background: linear-gradient(to top, var(--bg) 70%, transparent);
	}

	[aria-invalid='true'] {
		border-color: var(--danger);
	}
</style>
