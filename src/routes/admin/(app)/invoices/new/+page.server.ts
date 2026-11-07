import { getBooking } from '#lib/server/bookings.js';
import { requireAdmin } from '#lib/server/guard.js';
import { editorOptions } from '#lib/server/invoice-editor.js';
import { draftInvoice, getInvoice, type InvoiceInput } from '#lib/server/invoices.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	requireAdmin(locals);

	// ?from=<id> duplicates an invoice with a new number and today's dates.
	const source = getInvoice(Number(url.searchParams.get('from')) || 0);
	const jobId = Number(url.searchParams.get('job')) || source?.bookingId || 0;
	const fresh = draftInvoice(jobId ? getBooking(jobId) : undefined);

	let draft: InvoiceInput = fresh;
	if (source) {
		const { id: _id, total: _total, createdAt: _c, updatedAt: _u, ...copy } = source;
		draft = {
			...copy,
			number: fresh.number,
			issueDate: fresh.issueDate,
			dueDate: fresh.dueDate,
			paidAt: null
		};
	}
	return { draft, ...editorOptions() };
};
