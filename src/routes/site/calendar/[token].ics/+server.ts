import { error } from '@sveltejs/kit';
import { calendarFeed, isCalendarToken } from '#lib/server/calendar.js';
import type { RequestHandler } from './$types';

/** The jobs feed for calendar apps, which can't sign in; the token in the link is the access. */
export const GET: RequestHandler = ({ params, url }) => {
	if (!isCalendarToken(params.token)) error(404, 'Not found');
	return new Response(calendarFeed(url.origin), {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': 'inline; filename="jobs.ics"',
			'cache-control': 'private, no-store',
			'x-robots-tag': 'noindex'
		}
	});
};
