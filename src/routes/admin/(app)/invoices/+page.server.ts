import { requireAdmin } from '#lib/server/guard.js';
import { listInvoices } from '#lib/server/invoices.js';
import { todayIso } from '#lib/utils.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends }) => {
	requireAdmin(locals);
	depends('admin:invoices');
	const invoices = listInvoices();
	const year = todayIso().slice(0, 4);
	const sum = (list: typeof invoices) => list.reduce((total, invoice) => total + invoice.total, 0);
	const unpaid = invoices.filter((invoice) => invoice.state !== 'paid');
	const overdue = invoices.filter((invoice) => invoice.state === 'overdue');
	const paidThisYear = invoices.filter((invoice) => invoice.paidAt?.startsWith(year));
	return {
		invoices,
		stats: {
			outstanding: sum(unpaid),
			unpaidCount: unpaid.length,
			overdue: sum(overdue),
			overdueCount: overdue.length,
			paidThisYear: sum(paidThisYear),
			paidThisYearCount: paidThisYear.length,
			year
		}
	};
};
