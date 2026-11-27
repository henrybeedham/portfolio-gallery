import { listEnquiries } from '#lib/server/enquiries.js';
import { requireAdmin } from '#lib/server/guard.js';
import { getSettings } from '#lib/server/settings.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends }) => {
	requireAdmin(locals);
	depends('admin:enquiries');
	return { enquiries: listEnquiries(), formOn: getSettings().enquiryForm };
};
