import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.isAdmin) {
		redirect(303, `/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
	return {};
};
