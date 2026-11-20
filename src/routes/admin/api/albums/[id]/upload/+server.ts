import { error } from '@sveltejs/kit';
import { requireAdmin, requireAlbum } from '#lib/server/guard.js';
import { addPhoto } from '#lib/server/photos.js';
import { getSection } from '#lib/server/sections.js';
import { receiveUpload } from '#lib/server/upload-receiver.js';
import type { RequestHandler } from './$types';

/**
 * One piece of a photo or video for the album; see upload-receiver.ts for the protocol. An
 * optional `x-section-id` puts it in one of the album's sections.
 */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	requireAdmin(locals);
	const album = requireAlbum(params.id);
	const sectionHeader = request.headers.get('x-section-id');
	const sectionId = sectionHeader ? Number(sectionHeader) : null;
	if (sectionId !== null && !getSection(album.id, sectionId)) {
		error(404, 'That section no longer exists. Choose another and upload again.');
	}
	return receiveUpload(request, async (file, name, type) =>
		Response.json({ photo: await addPhoto(album.id, file, name, type, { sectionId }) })
	);
};
