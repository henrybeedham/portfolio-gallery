import { jobList, requireToken } from '#lib/server/lightroom.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => {
	requireToken(event);
	return Response.json({ jobs: jobList() });
};
