<!--
	The homepage enquiry form (Settings → Contact). Posts to the homepage's `enquire` action, which
	saves it under Admin → Enquiries and sends a notification.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Check from '@lucide/svelte/icons/check';

	interface Result {
		sent?: boolean;
		error?: string;
		field?: string;
		values?: Record<string, string>;
	}

	let { result }: { result?: Result } = $props();

	let sending = $state(false);
	const values = $derived(result?.values ?? {});
	const invalid = (field: string) => result?.field === field || undefined;
</script>

<section class="enquiry" aria-labelledby="enquiry-title">
	<p class="eyebrow" id="enquiry-title">Make an enquiry</p>
	{#if result?.sent}
		<p class="sent" role="status">
			<Check size={16} strokeWidth={1.5} />
			Thank you — your enquiry has been sent. You’ll hear back by email soon.
		</p>
	{:else}
		<form
			method="POST"
			action="?/enquire"
			use:enhance={() => {
				sending = true;
				return async ({ update }) => {
					await update({ reset: false, invalidateAll: false });
					sending = false;
				};
			}}
		>
			{#if result?.error}
				<p class="alert alert-error" role="alert">{result.error}</p>
			{/if}
			<div class="row">
				<div class="field">
					<label for="enquiry-name">Name</label>
					<input
						id="enquiry-name"
						class="input"
						name="name"
						autocomplete="name"
						required
						maxlength="120"
						value={values.name ?? ''}
						aria-invalid={invalid('name')}
					/>
				</div>
				<div class="field">
					<label for="enquiry-email">Email</label>
					<input
						id="enquiry-email"
						class="input"
						type="email"
						name="email"
						autocomplete="email"
						required
						maxlength="200"
						value={values.email ?? ''}
						aria-invalid={invalid('email')}
					/>
				</div>
			</div>
			<div class="row">
				<div class="field">
					<label for="enquiry-phone">Phone <span class="optional">optional</span></label>
					<input
						id="enquiry-phone"
						class="input"
						type="tel"
						name="phone"
						autocomplete="tel"
						maxlength="40"
						value={values.phone ?? ''}
					/>
				</div>
				<div class="field">
					<label for="enquiry-date">Date <span class="optional">optional</span></label>
					<input
						id="enquiry-date"
						class="input"
						type="date"
						name="eventDate"
						value={values.eventDate ?? ''}
					/>
				</div>
			</div>
			<div class="field">
				<label for="enquiry-location">Location <span class="optional">optional</span></label>
				<input
					id="enquiry-location"
					class="input"
					name="location"
					maxlength="200"
					value={values.location ?? ''}
				/>
			</div>
			<div class="field">
				<label for="enquiry-message">Message</label>
				<textarea
					id="enquiry-message"
					class="textarea"
					name="message"
					rows="5"
					required
					minlength="10"
					maxlength="5000"
					placeholder="What would you like photographed?"
					aria-invalid={invalid('message')}>{values.message ?? ''}</textarea
				>
			</div>
			<!-- Hidden from people; bots that fill in every field give themselves away. -->
			<div class="trap" aria-hidden="true">
				<label for="enquiry-website">Website</label>
				<input id="enquiry-website" name="website" tabindex="-1" autocomplete="off" />
			</div>
			<div>
				<button class="btn btn-solid" disabled={sending}>
					{#if sending}<span class="spinner"></span>{/if} Send Enquiry
				</button>
			</div>
		</form>
	{/if}
</section>

<style>
	.enquiry {
		display: grid;
		gap: 1.25rem;
		margin-top: 1rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	form {
		display: grid;
		gap: 1.1rem;
		font-size: 0.95rem;
	}

	.row {
		display: grid;
		gap: 1.1rem;
	}

	@media (min-width: 560px) {
		.row {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}

	.optional {
		text-transform: none;
		letter-spacing: 0;
		color: var(--text-subtle);
	}

	[aria-invalid='true'] {
		border-color: var(--danger);
	}

	.sent {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: var(--text);
		font-size: 0.95rem;
	}

	.trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
