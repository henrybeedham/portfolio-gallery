import { error } from '@sveltejs/kit';
import { getBooking } from '#lib/server/bookings.js';
import { requireAdmin } from '#lib/server/guard.js';
import { editorOptions } from '#lib/server/invoice-editor.js';
import { getInvoice } from '#lib/server/invoices.js';
import { invoiceState } from '#lib/server/bookings.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, depends }) => {
	requireAdmin(locals);
	depends('admin:invoice');
	const invoice = getInvoice(Number(params.id));
	if (!invoice) error(404, 'Invoice not found');
	const linked = invoice.bookingIds
		.map(getBooking)
		.filter((job) => !!job)
		.map(({ id, title, startsAt }) => ({ id, title, startsAt }));
	return {
		invoice,
		state: invoiceState(invoice),
		linked,
		...editorOptions()
	};
};
