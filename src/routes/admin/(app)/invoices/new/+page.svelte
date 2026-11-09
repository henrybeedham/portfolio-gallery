<script lang="ts">
	import BackLink from '#lib/components/admin/BackLink.svelte';
	import InvoiceEditor from '#lib/components/admin/InvoiceEditor.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const missingDetails = $derived(!data.invoiceSettings.sender.name);
</script>

<svelte:head>
	<title>New invoice — {data.settings.siteTitle}</title>
</svelte:head>

<BackLink list="invoices" label="Invoices" />

<header class="ui-head head">
	<div>
		<p class="eyebrow">No. {data.initial.number}</p>
		<h1>New invoice</h1>
	</div>
</header>

{#if missingDetails}
	<p class="alert notice">
		Your name, address and bank details aren’t set yet. Add them once in
		<a href="/admin/invoices/settings">invoice settings</a> and every new invoice will include them.
	</p>
{/if}

{#key data.initial.number}
	<InvoiceEditor
		mode="create"
		fillHours={!data.duplicate}
		initial={data.initial}
		addresses={data.addresses}
		jobs={data.jobs}
		clients={data.clients}
		themes={data.themes}
		settings={data.invoiceSettings}
	/>
{/key}

<style>
	.head {
		margin-top: 1.5rem;
	}

	.notice {
		max-width: 640px;
		margin-bottom: 1.5rem;
		color: var(--warning);
		background: var(--warning-soft);
	}
</style>
