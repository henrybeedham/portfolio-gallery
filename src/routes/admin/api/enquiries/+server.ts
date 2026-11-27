import { error } from '@sveltejs/kit';
import {
	deleteEnquiry,
	getEnquiry,
	makeJobFromEnquiry,
	setEnquiryArchived,
	setEnquiryRead
} from '#lib/server/enquiries.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	const body = await request.json().catch(() => null);
	const id = Number(body?.id);
	if (!Number.isInteger(id) || !getEnquiry(id)) error(404, 'That enquiry no longer exists.');
	switch (body?.action) {
		case 'set-read':
			setEnquiryRead(id, !!body.value);
			return Response.json({ ok: true });
		case 'set-archived':
			setEnquiryArchived(id, !!body.value);
			return Response.json({ ok: true });
		case 'make-job':
			return Response.json({ bookingId: makeJobFromEnquiry(id) });
		case 'delete':
			deleteEnquiry(id);
			return Response.json({ ok: true });
		default:
			error(400, 'Unknown action');
	}
};
