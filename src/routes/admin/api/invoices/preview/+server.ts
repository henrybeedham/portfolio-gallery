import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard.js';
import { renderInvoicePdf } from '#lib/server/invoice-pdf.js';
import { storePreview } from '#lib/server/invoice-preview.js';
import { parseInvoice } from '#lib/server/invoices.js';
import type { RequestHandler } from './$types';

/** Renders unsaved changes from the invoice editor and returns a URL for the live preview. */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	const result = parseInvoice(await request.json().catch(() => null));
	if (!result.ok) error(400, result.error);
	const pdf = await renderInvoicePdf({
		...result.input,
		number: result.input.number || '00000000'
	});
	return Response.json({ url: `/admin/api/invoices/preview/${storePreview(pdf)}` });
};
