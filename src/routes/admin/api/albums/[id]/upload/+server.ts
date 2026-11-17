import { requireAdmin, requireAlbum } from '#lib/server/guard.js';
import { addPhoto } from '#lib/server/photos.js';
import { receiveUpload } from '#lib/server/upload-receiver.js';
import type { RequestHandler } from './$types';

/** One piece of a photo or video for the album; see upload-receiver.ts for the protocol. */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	requireAdmin(locals);
	const album = requireAlbum(params.id);
	return receiveUpload(request, async (file, name, type) =>
		Response.json({ photo: await addPhoto(album.id, file, name, type) })
	);
};
