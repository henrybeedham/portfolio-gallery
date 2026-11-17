import { dashboard } from '#lib/server/dashboard.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends }) => {
	requireAdmin(locals);
	depends('admin:albums');
	depends('admin:bookings');
	depends('admin:invoices');
	return dashboard();
};
