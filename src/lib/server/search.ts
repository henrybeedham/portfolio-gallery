/** Everything the admin ⌘K search looks through. It's filtered in the browser as you type. */
import { listAdminAlbums } from './albums.js';
import { listBookings } from './bookings.js';
import { listInvoices } from './invoices.js';
import { formatMoney } from '#lib/money.js';
import type { SearchEntry } from '#lib/types.js';
import { formatJobDate, formatShortDay, invoiceLabel, plural } from '#lib/utils.js';

const INVOICE_STATES = { draft: 'Draft', paid: 'Paid', unpaid: 'Unpaid', overdue: 'Overdue' };

export function searchIndex(): SearchEntry[] {
	const entries: SearchEntry[] = [];

	for (const album of listAdminAlbums()) {
		entries.push({
			kind: 'gallery',
			title: album.title,
			detail: `/${album.slug} · ${plural(album.count, 'photo')}`,
			href: `/admin/albums/${album.id}`,
			keywords: album.slug
		});
	}

	// Upcoming jobs first (soonest first), then past ones (most recent first).
	const bookings = listBookings();
	const jobs = [
		...bookings.filter((b) => b.upcoming),
		...bookings.filter((b) => !b.upcoming).reverse()
	];
	const clients = new Map<string, { name: string; jobs: number }>();
	for (const job of jobs) {
		entries.push({
			kind: 'job',
			title: job.title,
			detail: [
				formatJobDate(job.startsAt).day || 'Date TBC',
				job.client,
				job.status === 'cancelled' ? 'Cancelled' : ''
			]
				.filter(Boolean)
				.join(' · '),
			href: `/admin/jobs/${job.id}`,
			keywords: [job.location, job.billingLabel, ...job.invoices.map((i) => i.number)].join(' ')
		});
		const name = job.client.trim();
		if (name) {
			const key = name.toLowerCase();
			const client = clients.get(key) ?? { name, jobs: 0 };
			client.jobs++;
			clients.set(key, client);
		}
	}

	for (const invoice of listInvoices()) {
		entries.push({
			kind: 'invoice',
			title: `${invoiceLabel(invoice.number)} — ${invoice.billToName || 'No client'}`,
			detail: [
				INVOICE_STATES[invoice.state],
				formatMoney(invoice.total),
				invoice.state === 'draft' ? '' : formatShortDay(invoice.issueDate)
			]
				.filter(Boolean)
				.join(' · '),
			href: `/admin/invoices/${invoice.id}`,
			keywords: invoice.jobs.map((job) => job.title).join(' ')
		});
		const name = invoice.billToName.trim();
		if (name && !clients.has(name.toLowerCase())) {
			clients.set(name.toLowerCase(), { name, jobs: 0 });
		}
	}

	for (const client of [...clients.values()].sort((a, b) => a.name.localeCompare(b.name))) {
		entries.push({
			kind: 'client',
			title: client.name,
			detail: client.jobs ? plural(client.jobs, 'job') : 'Invoices only',
			href: client.jobs
				? `/admin/jobs?show=all&q=${encodeURIComponent(client.name)}`
				: `/admin/invoices?q=${encodeURIComponent(client.name)}`,
			keywords: ''
		});
	}

	return entries;
}
