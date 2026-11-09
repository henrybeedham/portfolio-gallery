import { everythingResponse } from '#lib/server/backups.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { RequestHandler } from './$types';

/** The database, original photos and videos, hero image and themes as one streamed ZIP. */
export const GET: RequestHandler = ({ request, locals }) => {
	requireAdmin(locals);
	return everythingResponse(request);
};
