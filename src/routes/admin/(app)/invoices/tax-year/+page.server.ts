import { requireAdmin } from '#lib/server/guard.js';
import {
	TAX_BASES,
	taxYearInvoices,
	taxYearLabel,
	taxYearOf,
	taxYears,
	type TaxBasis
} from '#lib/server/tax-year.js';
import { todayIso } from '#lib/utils.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	requireAdmin(locals);
	const years = taxYears();
	const requestedYear = Number(url.searchParams.get('year'));
	const year = years.includes(requestedYear) ? requestedYear : taxYearOf(todayIso());
	const requestedBasis = url.searchParams.get('basis') as TaxBasis;
	const basis = TAX_BASES.includes(requestedBasis) ? requestedBasis : 'paid';
	const invoices = taxYearInvoices(year, basis);
	return {
		year,
		basis,
		label: taxYearLabel(year),
		years: years.map((value) => ({ value, label: taxYearLabel(value) })),
		invoices,
		total: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
		unpaid: invoices
			.filter((invoice) => !invoice.paidAt)
			.reduce((sum, invoice) => sum + invoice.total, 0)
	};
};
