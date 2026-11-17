import { error } from '@sveltejs/kit';
import { renameAlbum } from '#lib/server/albums.js';
import { albumSummary, requireAlbumId, requireToken } from '#lib/server/lightroom.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => {
	requireToken(event);
	const album = requireAlbumId(event.params.id);
	return Response.json({ album: albumSummary(event.url.origin, album.id) });
};

export const POST: RequestHandler = async (event) => {
	requireToken(event);
	const album = requireAlbumId(event.params.id);
	const body = await event.request.json().catch(() => null);
	if (!body || typeof body.action !== 'string') error(400, 'Missing action');
	switch (body.action) {
		case 'rename': {
			const title = String(body.title ?? '')
				.trim()
				.slice(0, 200);
			if (!title) error(400, 'The album needs a title');
			renameAlbum(album.id, title);
			return Response.json({ album: albumSummary(event.url.origin, album.id) });
		}
		default:
			error(400, 'Unknown action');
	}
};
