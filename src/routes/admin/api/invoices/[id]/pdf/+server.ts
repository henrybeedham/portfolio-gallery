import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard.js';
import { renderInvoicePdf } from '#lib/server/invoice-pdf.js';
import { getInvoice, invoiceFilename } from '#lib/server/invoices.js';
import type { RequestHandler } from './$types';

/** The invoice as a PDF. Add ?inline=1 to view it in the browser instead of downloading it. */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	requireAdmin(locals);
	const invoice = getInvoice(Number(params.id));
	if (!invoice) error(404, 'Invoice not found');
	const pdf = await renderInvoicePdf(invoice);
	const filename = invoiceFilename(invoice.number);
	const disposition = url.searchParams.has('inline') ? 'inline' : 'attachment';
	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-length': String(pdf.length),
			'content-disposition': `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
			'cache-control': 'private, no-store'
		}
	});
};
