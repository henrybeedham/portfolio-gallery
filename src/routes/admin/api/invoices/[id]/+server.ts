import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard.js';
import {
	deleteInvoice,
	getInvoice,
	parseInvoice,
	setInvoicePaid,
	updateInvoice
} from '#lib/server/invoices.js';
import { isIsoDay, todayIso } from '#lib/utils.js';
import type { RequestHandler } from './$types';

function requireInvoice(id: string) {
	const invoice = getInvoice(Number(id));
	if (!invoice) error(404, 'Invoice not found');
	return invoice;
}

export const POST: RequestHandler = async ({ request, params, locals }) => {
	requireAdmin(locals);
	const invoice = requireInvoice(params.id);
	const body = await request.json().catch(() => null);
	if (!body || typeof body.action !== 'string') error(400, 'Missing action');

	switch (body.action) {
		case 'save': {
			const result = parseInvoice(body.invoice);
			if (!result.ok) error(400, result.error);
			updateInvoice(invoice.id, { ...result.input, number: invoice.number });
			return Response.json({ ok: true });
		}
		case 'set-paid': {
			const paidAt =
				body.paid === false
					? null
					: typeof body.date === 'string' && isIsoDay(body.date)
						? body.date
						: todayIso();
			setInvoicePaid(invoice.id, paidAt);
			return Response.json({ ok: true, paidAt });
		}
		default:
			error(400, 'Unknown action');
	}
};

export const DELETE: RequestHandler = ({ params, locals }) => {
	requireAdmin(locals);
	const invoice = requireInvoice(params.id);
	deleteInvoice(invoice.id);
	return Response.json({ ok: true });
};
