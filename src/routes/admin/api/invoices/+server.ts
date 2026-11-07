import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard.js';
import {
	createInvoice,
	generateInvoiceNumber,
	isInvoiceNumberTaken,
	parseInvoice
} from '#lib/server/invoices.js';
import type { RequestHandler } from './$types';

/** Creates an invoice. The number shown in the editor is kept unless another invoice took it. */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	const result = parseInvoice(await request.json().catch(() => null));
	if (!result.ok) error(400, result.error);
	const input = result.input;
	if (!/^[1-9]\d{7}$/.test(input.number) || isInvoiceNumberTaken(input.number)) {
		input.number = generateInvoiceNumber();
	}
	const id = createInvoice(input);
	return Response.json({ id, number: input.number });
};
