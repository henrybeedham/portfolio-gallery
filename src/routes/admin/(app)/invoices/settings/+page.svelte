<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Plus from '@lucide/svelte/icons/plus';
	import ThemePicker from '#lib/components/admin/ThemePicker.svelte';
	import Toggle from '#lib/components/admin/Toggle.svelte';
	import { feedback } from '#lib/components/admin/feedback.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const initial = untrack(() => data.current);
	let style = $state(initial.style);
	let dueOnShootDate = $state(initial.dueOnShootDate);
	let saving = $state(false);
	let adding = $state(false);

	const messages: Record<string, string> = {
		settings: 'Invoice settings saved',
		address: 'Address saved',
		'address-added': 'Address added',
		'address-deleted': 'Address deleted'
	};

	const submit: SubmitFunction = ({ formElement, action }) => {
		const isSettings = action.search.includes('save');
		if (isSettings) saving = true;
		return async ({ result, update }) => {
			await update({ reset: action.search.includes('addAddress') });
			saving = false;
			if (result.type === 'success') {
				feedback.toast(messages[String(result.data?.saved)] ?? 'Saved');
				if (action.search.includes('addAddress')) {
					adding = false;
					formElement.reset();
				}
			} else if (result.type === 'failure') {
				feedback.toast(String(result.data?.error ?? 'Please check the form'), 'error');
			} else if (result.type === 'error') {
				feedback.toast('Something went wrong', 'error');
			}
		};
	};

	/** Address forms: “Delete” asks first. */
	const addressSubmit: SubmitFunction = async (input) => {
		if (input.action.search.includes('deleteAddress')) {
			const label = String(input.formData.get('label') || 'this address');
			const ok = await feedback.confirm({
				title: `Delete “${label}”?`,
				message:
					'Existing invoices keep their copy of the address. Jobs using it will switch to “Other”.',
				confirmLabel: 'Delete address',
				danger: true
			});
			if (!ok) {
				input.cancel();
				return;
			}
		}
		return submit(input);
	};
</script>

<svelte:head>
	<title>Invoice settings — {data.settings.siteTitle}</title>
</svelte:head>

<a class="link" href="/admin/invoices"><ArrowLeft size={14} /> Invoices</a>

<header class="head">
	<p class="eyebrow">Invoices</p>
	<h1>Invoice settings</h1>
	<p class="muted">
		Defaults for new invoices. Each invoice keeps its own copy, so changes here never alter invoices
		you’ve already made.
	</p>
</header>

<div class="page">
	<form method="POST" action="?/save" class="stack" use:enhance={submit}>
		<section class="ui-card" id="details">
			<div class="ui-card-head">
				<h2>Your details</h2>
				<p class="hint">Printed at the top of every invoice.</p>
			</div>
			<div class="ui-grid-2">
				<div class="field">
					<label for="senderName">Name</label>
					<input id="senderName" class="input" name="senderName" value={initial.sender.name} />
				</div>
				<div class="field">
					<label for="senderEmail">Email</label>
					<input
						id="senderEmail"
						class="input"
						type="email"
						name="senderEmail"
						value={initial.sender.email}
					/>
				</div>
			</div>
			<div class="ui-grid-2">
				<div class="field">
					<label for="senderAddress">Address</label>
					<textarea
						id="senderAddress"
						class="textarea ui-textarea-short"
						name="senderAddress"
						rows="3">{initial.sender.address}</textarea
					>
				</div>
				<div class="field">
					<label for="senderPhone">Phone</label>
					<input
						id="senderPhone"
						class="input"
						type="tel"
						name="senderPhone"
						value={initial.sender.phone}
					/>
				</div>
			</div>
			<div class="field">
				<label for="paymentDetails">Payment information</label>
				<textarea
					id="paymentDetails"
					class="textarea ui-textarea-short"
					name="paymentDetails"
					rows="3"
					placeholder="Name: …&#10;Account number: …&#10;Sort code: …"
					>{initial.paymentDetails}</textarea
				>
			</div>
		</section>

		<section class="ui-card" id="defaults">
			<div class="ui-card-head">
				<h2>Defaults</h2>
			</div>
			<div class="ui-grid-2">
				<div class="field">
					<label for="itemDescription">Line item</label>
					<input
						id="itemDescription"
						class="input"
						name="itemDescription"
						value={initial.itemDescription}
					/>
				</div>
				<div class="field">
					<label for="hourlyRate">Hourly rate</label>
					<div class="ui-money-input">
						<input
							id="hourlyRate"
							class="input"
							name="hourlyRate"
							value={data.rate}
							inputmode="decimal"
						/>
					</div>
					<p class="hint">Also the starting rate for new jobs.</p>
				</div>
			</div>
			<div class="field">
				<label for="notes">Notes</label>
				<textarea id="notes" class="textarea ui-textarea-short" name="notes" rows="2"
					>{initial.notes}</textarea
				>
			</div>
			<div class="ui-grid-2 terms">
				<div class="field">
					<label for="paymentTermsDays">Payment terms</label>
					<div class="ui-inline">
						<input
							id="paymentTermsDays"
							class="input days"
							name="paymentTermsDays"
							type="number"
							min="0"
							max="365"
							value={initial.paymentTermsDays}
						/>
						<span class="muted">days after the invoice date</span>
					</div>
				</div>
				<Toggle
					name="dueOnShootDate"
					label="Due on the shoot date"
					description="When the job is still ahead, make the invoice due on the day you shoot it."
					bind:checked={dueOnShootDate}
				/>
			</div>
			<div class="field">
				<span class="label">Style</span>
				<ThemePicker themes={data.themes} name="style" bind:value={style} compact />
				<p class="hint">
					Independent of the site theme, and can be changed on each invoice. New styles come from
					the same theme files as the site.
				</p>
			</div>
		</section>

		<div class="submit">
			<button class="btn btn-solid" disabled={saving}>
				{#if saving}<span class="spinner"></span>{/if} Save Settings
			</button>
		</div>
	</form>

	<section class="ui-card" id="addresses">
		<div class="ui-card-head">
			<h2>Saved addresses</h2>
			<p class="hint">
				Pick one when you bill a society, e.g. AU or Guild. The short name is what you click; the
				organisation and address are printed under the society’s name.
			</p>
		</div>

		{#each data.addresses as address (address.id)}
			<form method="POST" action="?/updateAddress" class="address" use:enhance={addressSubmit}>
				<input type="hidden" name="id" value={address.id} />
				<div class="address-grid">
					<div class="field">
						<label for="label-{address.id}">Short name</label>
						<input
							id="label-{address.id}"
							class="input"
							name="label"
							value={address.label}
							required
						/>
					</div>
					<div class="field">
						<label for="org-{address.id}">Organisation</label>
						<input
							id="org-{address.id}"
							class="input"
							name="organisation"
							value={address.organisation}
							required
						/>
					</div>
				</div>
				<div class="field">
					<label for="addr-{address.id}">Address</label>
					<textarea
						id="addr-{address.id}"
						class="textarea ui-textarea-short"
						name="address"
						rows="4">{address.address}</textarea
					>
				</div>
				<div class="address-actions">
					<button class="btn btn-sm btn-danger" formaction="?/deleteAddress" formnovalidate
						>Delete</button
					>
					<button class="btn btn-sm btn-quiet">Save address</button>
				</div>
			</form>
		{/each}

		{#if adding}
			<form method="POST" action="?/addAddress" class="address" use:enhance={submit}>
				<div class="address-grid">
					<div class="field">
						<label for="label-new">Short name</label>
						<input id="label-new" class="input" name="label" placeholder="Guild" required />
					</div>
					<div class="field">
						<label for="org-new">Organisation</label>
						<input id="org-new" class="input" name="organisation" required />
					</div>
				</div>
				<div class="field">
					<label for="addr-new">Address</label>
					<textarea id="addr-new" class="textarea ui-textarea-short" name="address" rows="4"
					></textarea>
				</div>
				<div class="address-actions">
					<button type="button" class="btn btn-sm btn-quiet" onclick={() => (adding = false)}
						>Cancel</button
					>
					<button class="btn btn-sm btn-solid">Add address</button>
				</div>
			</form>
		{:else}
			<div>
				<button class="btn btn-sm btn-quiet" onclick={() => (adding = true)}>
					<Plus size={13} /> Add address
				</button>
			</div>
		{/if}
	</section>
</div>

<style>
	.head {
		margin: 1.5rem 0 2rem;
		max-width: 760px;
	}

	h1 {
		font-size: clamp(2.2rem, 4vw, 3rem);
		margin: 0.5rem 0 0.75rem;
	}

	.page {
		display: grid;
		gap: 1.5rem;
		max-width: 860px;
	}

	.stack {
		display: grid;
		gap: 1.5rem;
	}

	.terms {
		align-items: end;
	}

	.days {
		width: 90px;
	}

	.submit {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		padding-block: 1rem;
		background: linear-gradient(to top, var(--bg) 70%, transparent);
	}

	.address {
		display: grid;
		gap: 1rem;
		padding-bottom: 1.4rem;
		border-bottom: 1px solid var(--border);
	}

	.address-grid {
		display: grid;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.address-grid {
			grid-template-columns: 160px minmax(0, 1fr);
		}
	}

	.address-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
