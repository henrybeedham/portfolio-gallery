import { getBooking } from '#lib/server/bookings.js';
import { requireAdmin } from '#lib/server/guard.js';
import { editorOptions } from '#lib/server/invoice-editor.js';
import { getInvoice, newInvoice, type InvoiceInput } from '#lib/server/invoices.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	requireAdmin(locals);

	// ?from=<id> duplicates an invoice with a new number and today's dates. Imported records have
	// none of your details on them, so they aren't copied.
	const found = getInvoice(Number(url.searchParams.get('from')) || 0);
	const source = found && !found.imported ? found : undefined;
	const jobId = Number(url.searchParams.get('job'));
	const jobs = (jobId ? [jobId] : (source?.bookingIds ?? []))
		.map(getBooking)
		.filter((job) => !!job);
	const fresh = newInvoice(jobs);

	let initial: InvoiceInput = fresh;
	if (source) {
		const { id: _id, total: _total, createdAt: _c, updatedAt: _u, ...copy } = source;
		initial = {
			...copy,
			number: fresh.number,
			issueDate: fresh.issueDate,
			dueDate: fresh.dueDate,
			paidAt: null,
			draft: false
		};
	}
	return { initial, duplicate: !!source, ...editorOptions() };
};
