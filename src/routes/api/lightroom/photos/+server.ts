import { error } from '@sveltejs/kit';
import { requireToken } from '#lib/server/lightroom.js';
import { deletePhotos, getPhoto } from '#lib/server/photos.js';
import type { RequestHandler } from './$types';

/** Photos removed from a published collection in Lightroom. Ones already gone count as deleted. */
export const POST: RequestHandler = async (event) => {
	requireToken(event);
	const body = await event.request.json().catch(() => null);
	if (!body || body.action !== 'delete' || !Array.isArray(body.ids)) error(400, 'Missing ids');
	const ids = body.ids.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0);
	const byAlbum = new Map<number, number[]>();
	for (const id of ids) {
		const row = getPhoto(id);
		if (row) byAlbum.set(row.album_id, [...(byAlbum.get(row.album_id) ?? []), id]);
	}
	for (const [albumId, list] of byAlbum) await deletePhotos(albumId, list);
	return Response.json({ deleted: ids });
};
