import { requireToken } from '#lib/server/lightroom.js';
import { widgetData } from '#lib/server/widget.js';
import type { RequestHandler } from './$types';

/** What the Scriptable widgets show. A widget token (read-only) or a full token can read it. */
export const GET: RequestHandler = (event) => {
	requireToken(event, 'widget');
	return Response.json(widgetData(event.url.origin), {
		headers: { 'cache-control': 'no-store' }
	});
};
