import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard.js';
import { getJob } from '#lib/server/jobs.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, locals }) => {
	requireAdmin(locals);
	const job = getJob(params.id);
	if (!job) error(404, 'Job not found');
	return Response.json({ job }, { headers: { 'cache-control': 'no-store' } });
};
