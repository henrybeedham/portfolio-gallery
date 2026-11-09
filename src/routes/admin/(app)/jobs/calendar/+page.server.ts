import { calendarToken } from '#lib/server/calendar.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends, url }) => {
	requireAdmin(locals);
	depends('admin:calendar');
	return { feedUrl: `${url.origin}/site/calendar/${calendarToken()}.ics` };
};
