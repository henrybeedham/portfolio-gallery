import { requireAdmin } from '#lib/server/guard.js';
import { searchIndex } from '#lib/server/search.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	requireAdmin(locals);
	return Response.json(searchIndex(), { headers: { 'cache-control': 'no-store' } });
};
