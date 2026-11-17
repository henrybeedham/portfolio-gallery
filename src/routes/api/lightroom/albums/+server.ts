import { error } from '@sveltejs/kit';
import { albumList, albumSummary, createAlbumFor, requireToken } from '#lib/server/lightroom.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => {
	requireToken(event);
	return Response.json({ albums: albumList(event.url.origin) });
};

export const POST: RequestHandler = async (event) => {
	requireToken(event);
	const body = await event.request.json().catch(() => null);
	if (!body || typeof body.action !== 'string') error(400, 'Missing action');
	switch (body.action) {
		case 'create': {
			const id = createAlbumFor({
				title: String(body.title ?? ''),
				jobId: Number.isSafeInteger(body.jobId) && body.jobId > 0 ? body.jobId : null,
				isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : undefined
			});
			return Response.json({ album: albumSummary(event.url.origin, id) });
		}
		default:
			error(400, 'Unknown action');
	}
};
