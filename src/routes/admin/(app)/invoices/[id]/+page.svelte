<script lang="ts">
	import { listUrl } from '#lib/components/admin/list-memory.js';
	import BackLink from '#lib/components/admin/BackLink.svelte';
	import { goto, invalidate } from '$app/navigation';
	import Download from '@lucide/svelte/icons/download';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Copy from '@lucide/svelte/icons/copy';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import InvoiceEditor from '#lib/components/admin/InvoiceEditor.svelte';
	import StateBadge from '#lib/components/admin/StateBadge.svelte';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { formatMoney } from '#lib/money.js';
	import { formatShortDay } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let editor = $state<ReturnType<typeof InvoiceEditor>>();

	const invoice = $derived(data.invoice);
	const pdfUrl = $derived(`/admin/api/invoices/${invoice.id}/pdf`);

	async function download() {
		if (editor?.isDirty() && !(await editor.save())) return;
		window.location.href = pdfUrl;
	}

	async function remove() {
		const ok = await feedback.confirm({
			title: `Delete invoice ${invoice.number}?`,
			message:
				'This permanently deletes the invoice. Its number won’t be reused unless no record of it remains.',
			confirmLabel: 'Delete invoice',
			danger: true
		});
		if (!ok) return;
		try {
			await api(`/admin/api/invoices/${invoice.id}`, undefined, 'DELETE');
			feedback.toast(`Deleted invoice ${invoice.number}`);
			await goto(listUrl('invoices'));
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		}
	}

	async function duplicate() {
		if (editor?.isDirty() && !(await editor.save())) return;
		await goto(`/admin/invoices/new?from=${invoice.id}`);
	}
</script>

<svelte:head>
	<title>Invoice {invoice.number} — Admin</title>
</svelte:head>

<BackLink list="invoices" label="Invoices" />

<header class="ui-head head">
	<div>
		<p class="eyebrow">Invoice</p>
		<h1>No. {invoice.number}</h1>
		<div class="ui-badges badges">
			<StateBadge state={data.state} />
			<span class="subtle">
				{formatMoney(invoice.total)} · issued {formatShortDay(invoice.issueDate)}
				{#if data.booking}
					· <a href="/admin/jobs/{data.booking.id}">{data.booking.title}</a>
				{/if}
			</span>
		</div>
	</div>
	<div class="ui-actions">
		<button class="btn btn-sm btn-solid" onclick={download}
			><Download size={13} /> Download PDF</button
		>
		<a class="btn btn-sm btn-quiet" href="{pdfUrl}?inline=1" target="_blank" rel="noopener">
			<ExternalLink size={13} /> Open
		</a>
		<button class="btn btn-sm btn-quiet" onclick={duplicate}><Copy size={13} /> Duplicate</button>
		<button class="btn btn-sm btn-danger" onclick={remove}><Trash2 size={13} /> Delete</button>
	</div>
</header>

{#key invoice.id}
	<InvoiceEditor
		bind:this={editor}
		mode="edit"
		invoiceId={invoice.id}
		initial={invoice}
		addresses={data.addresses}
		jobs={data.jobs}
		clients={data.clients}
		themes={data.themes}
		settings={data.invoiceSettings}
		onsaved={() => invalidate('admin:invoice')}
	/>
{/key}

<style>
	.head {
		margin-top: 1.5rem;
	}

	.badges {
		align-items: center;
		margin-top: 0.85rem;
	}

	.badges a {
		color: inherit;
		text-underline-offset: 3px;
	}
</style>
