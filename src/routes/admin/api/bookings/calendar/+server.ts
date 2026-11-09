import { error } from '@sveltejs/kit';
import { resetCalendarToken } from '#lib/server/calendar.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	const body = await request.json().catch(() => null);
	switch (body?.action) {
		case 'reset':
			resetCalendarToken();
			return Response.json({ ok: true });
		default:
			error(400, 'Unknown action');
	}
};
