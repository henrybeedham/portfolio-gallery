<script lang="ts" module>
	export interface BookingFormValues {
		title: string;
		client: string;
		billingAddressId: number | null;
		location: string;
		date: string;
		time: string;
		endTime: string;
		status: import('#lib/types.js').BookingStatus;
		delivered: boolean;
		notes: string;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Toggle from './Toggle.svelte';
	import { feedback } from './feedback.svelte.js';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { clashesFor, type ClashJob } from '#lib/job-clash.js';
	import type { BillingAddress, BookingStatus } from '#lib/types.js';
	import { formatJobDate } from '#lib/utils.js';

	interface Props {
		initial: BookingFormValues;
		addresses: BillingAddress[];
		clients: { client: string; billingAddressId: number | null }[];
		/** Other jobs, to warn about ones on the same day. */
		others?: ClashJob[];
		/** This job's id when editing, so it doesn't clash with itself. */
		jobId?: number;
		action?: string;
		submitLabel?: string;
		error?: string | null;
		errorField?: string | null;
	}

	let {
		initial,
		addresses,
		clients,
		others = [],
		jobId,
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
	let endTime = $state(start.endTime);
	let status = $state<BookingStatus>(start.status);
	let delivered = $state(start.delivered);
	let saving = $state(false);

	const clashes = $derived(
		clashesFor(
			{
				id: jobId,
				startsAt: date ? (time ? `${date}T${time}` : date) : null,
				endsAt: date && time && endTime ? `${date}T${endTime}` : null,
				status
			},
			others
		)
	);

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
		<div class="ui-grid-3">
			<div class="field">
				<label for="date">Date <span class="ui-optional">optional</span></label>
				<input
					id="date"
					class="input"
					type="date"
					name="date"
					bind:value={date}
					aria-invalid={errorField === 'date'}
				/>
			</div>
			<div class="field">
				<label for="time">Start time <span class="ui-optional">optional</span></label>
				<input
					id="time"
					class="input"
					type="time"
					name="time"
					bind:value={time}
					aria-invalid={errorField === 'time'}
				/>
			</div>
			<div class="field">
				<label for="end-time">End time <span class="ui-optional">optional</span></label>
				<input
					id="end-time"
					class="input"
					type="time"
					name="end_time"
					bind:value={endTime}
					aria-invalid={errorField === 'end_time'}
				/>
			</div>
		</div>
		<p class="hint">
			An end time sets the length in your calendar and the hours on new invoices.
			{#if time && endTime && endTime < time}This job finishes the next day.{/if}
		</p>
		{#if clashes.length}
			{@const overlapping = clashes.filter((clash) => clash.overlap)}
			{@const sameDay = clashes.filter((clash) => !clash.overlap)}
			<div class="clashes" role="status">
				{#if overlapping.length}
					<p class="clash">
						<TriangleAlert size={15} strokeWidth={1.5} />
						<span>
							Clashes with
							{#each overlapping as clash, i (clash.job.id)}
								{@const when = formatJobDate(clash.job.startsAt, clash.job.endsAt)}
								{i ? (i === overlapping.length - 1 ? ' and ' : ', ') : ''}<a
									href="/admin/jobs/{clash.job.id}"
									target="_blank"
									rel="noopener"
								>
									{clash.job.title}
								</a>{when.time ? ` (${when.time})` : ''}{/each}.
						</span>
					</p>
				{/if}
				{#if sameDay.length}
					<p class="hint">
						Also on this day:
						{#each sameDay as clash, i (clash.job.id)}
							{@const when = formatJobDate(clash.job.startsAt, clash.job.endsAt)}
							{i ? ', ' : ''}<a href="/admin/jobs/{clash.job.id}" target="_blank" rel="noopener">
								{clash.job.title}
							</a>{when.time ? ` at ${when.time}` : ''}{clash.job.status === 'tentative'
								? ' (tentative)'
								: ''}{/each}.
					</p>
				{/if}
			</div>
		{/if}
		<div class="field">
			<label for="location">Location <span class="ui-optional">optional</span></label>
			<input
				id="location"
				class="input"
				name="location"
				bind:value={location}
				placeholder="Town Hall"
			/>
		</div>
	</section>

	<section class="ui-card">
		<div class="ui-card-head">
			<h2>Client</h2>
			<p class="hint">Used to fill in “Bill to” on this job’s invoices.</p>
		</div>
		<div class="field">
			<label for="client">Client</label>
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
			<Toggle
				name="delivered"
				label="Delivered"
				description="Ticks itself once a linked gallery is public and has photos in it."
				bind:checked={delivered}
			/>
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
	.clashes {
		display: grid;
		gap: 0.5rem;
		margin-top: -0.5rem;
	}

	.clash {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid color-mix(in srgb, var(--warning) 50%, transparent);
		background: var(--warning-soft);
		color: var(--warning);
		font-size: 0.88rem;
	}

	.clash :global(svg) {
		flex: none;
		margin-top: 0.15rem;
	}

	.clashes a {
		color: inherit;
		text-underline-offset: 3px;
	}

	.form {
		display: grid;
		gap: 1.5rem;
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
