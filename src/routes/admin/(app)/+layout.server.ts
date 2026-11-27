import { redirect } from '@sveltejs/kit';
import { unreadEnquiryCount } from '#lib/server/enquiries.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url, depends }) => {
	if (!locals.isAdmin) {
		redirect(303, `/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	depends('admin:enquiries');
	return { unreadEnquiries: unreadEnquiryCount() };
};
