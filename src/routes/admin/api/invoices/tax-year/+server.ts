import { requireAdmin } from '#lib/server/guard.js';
import {
	TAX_BASES,
	taxYearCsv,
	taxYearInvoices,
	taxYearLabel,
	taxYearOf,
	type TaxBasis
} from '#lib/server/tax-year.js';
import { contentDisposition } from '#lib/server/zip.js';
import { todayIso } from '#lib/utils.js';
import type { RequestHandler } from './$types';

/** A tax year's invoices as CSV: ?year=2025 (for 2025–26) and ?basis=paid|issued. */
export const GET: RequestHandler = ({ url, locals }) => {
	requireAdmin(locals);
	const year = Number(url.searchParams.get('year')) || taxYearOf(todayIso());
	const requested = url.searchParams.get('basis') as TaxBasis;
	const basis = TAX_BASES.includes(requested) ? requested : 'paid';
	const csv = taxYearCsv(taxYearInvoices(year, basis));
	const filename = `Invoices ${taxYearLabel(year).replace('–', '-')} (${basis}).csv`;
	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': contentDisposition(filename),
			'cache-control': 'no-store'
		}
	});
};
