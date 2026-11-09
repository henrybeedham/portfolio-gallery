<script lang="ts">
	import { listUrl } from '#lib/components/admin/list-memory.js';
	import BackLink from '#lib/components/admin/BackLink.svelte';
	import { goto, invalidate } from '$app/navigation';
	import Download from '@lucide/svelte/icons/download';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Copy from '@lucide/svelte/icons/copy';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Send from '@lucide/svelte/icons/send';
	import InvoiceEditor from '#lib/components/admin/InvoiceEditor.svelte';
	import StateBadge from '#lib/components/admin/StateBadge.svelte';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { formatMoney } from '#lib/money.js';
	import {
		formatShortDay,
		invoiceDueDate,
		invoiceLabel,
		lastShootDay,
		todayIso
	} from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let editor = $state<ReturnType<typeof InvoiceEditor>>();

	const invoice = $derived(data.invoice);
	const label = $derived(invoiceLabel(invoice.number));
	const pdfUrl = $derived(`/admin/api/invoices/${invoice.id}/pdf`);
	let issuing = $state(false);

	/** Sends a draft: the server dates it today and works out the due date as for a new invoice. */
	async function issue() {
		if (editor?.isDirty() && !(await editor.save())) return;
		const today = todayIso();
		const due = invoiceDueDate(today, lastShootDay(data.linked), data.invoiceSettings);
		const ok = await feedback.confirm({
			title: `Issue invoice ${label}?`,
			message: `It’ll be dated today and due ${formatShortDay(due)}. You can still change the dates afterwards.`,
			confirmLabel: 'Issue Invoice'
		});
		if (!ok) return;
		issuing = true;
		try {
			await api(`/admin/api/invoices/${invoice.id}`, { action: 'issue' });
			await invalidate('admin:invoice');
			feedback.toast(`Invoice ${label} issued`);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			issuing = false;
		}
	}

	async function download() {
		if (editor?.isDirty() && !(await editor.save())) return;
		window.location.href = pdfUrl;
	}

	async function remove() {
		const ok = await feedback.confirm({
			title: invoice.draft ? `Delete draft ${label}?` : `Delete invoice ${label}?`,
			message: invoice.draft
				? 'This permanently deletes the draft.'
				: 'This permanently deletes the invoice. Its number won’t be reused unless no record of it remains.',
			confirmLabel: invoice.draft ? 'Delete draft' : 'Delete invoice',
			danger: true
		});
		if (!ok) return;
		try {
			await api(`/admin/api/invoices/${invoice.id}`, undefined, 'DELETE');
			feedback.toast(`Deleted ${invoice.draft ? 'draft' : 'invoice'} ${label}`);
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
	<title>Invoice {label} — Admin</title>
</svelte:head>

<BackLink list="invoices" label="Invoices" />

<header class="ui-head head">
	<div>
		<p class="eyebrow">
			{invoice.imported ? 'Imported record' : invoice.draft ? 'Draft invoice' : 'Invoice'}
		</p>
		<h1>{invoice.number ? `No. ${invoice.number}` : label}</h1>
		<div class="ui-badges badges">
			<StateBadge state={data.state} />
			<span class="subtle">
				{formatMoney(invoice.total)}
				{#if !invoice.draft}· {invoice.imported ? 'dated' : 'issued'}
					{formatShortDay(invoice.issueDate)}{/if}
				{#each data.linked as job (job.id)}
					· <a href="/admin/jobs/{job.id}">{job.title}</a>
				{/each}
			</span>
		</div>
	</div>
	<div class="ui-actions">
		{#if invoice.draft}
			<button class="btn btn-sm btn-solid" onclick={issue} disabled={issuing}>
				{#if issuing}<span class="spinner"></span>{:else}<Send size={13} />{/if} Issue Invoice
			</button>
		{:else if !invoice.imported}
			<button class="btn btn-sm btn-solid" onclick={download}
				><Download size={13} /> Download PDF</button
			>
		{/if}
		{#if !invoice.imported}
			<a class="btn btn-sm btn-quiet" href="{pdfUrl}?inline=1" target="_blank" rel="noopener">
				<ExternalLink size={13} /> Open
			</a>
			<button class="btn btn-sm btn-quiet" onclick={duplicate}><Copy size={13} /> Duplicate</button>
		{/if}
		<button class="btn btn-sm btn-danger" onclick={remove}><Trash2 size={13} /> Delete</button>
	</div>
</header>

{#if invoice.imported}
	<p class="alert notice">
		An invoice sent from another platform, or converted from a job’s old fee, paid tick or earlier
		invoice numbers. There’s no PDF, because it wasn’t made here.
	</p>
{/if}

<!-- Issuing changes the dates on the server, so the editor starts again from the saved invoice. -->
{#key `${invoice.id}:${invoice.draft}`}
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

	.notice {
		max-width: 640px;
		margin-bottom: 1.5rem;
	}
</style>
