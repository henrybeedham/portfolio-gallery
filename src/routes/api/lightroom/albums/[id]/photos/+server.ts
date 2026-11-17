import {
	photoSummary,
	photoToReplace,
	requireAlbumId,
	requireToken
} from '#lib/server/lightroom.js';
import { addPhoto, getPhoto, replacePhoto } from '#lib/server/photos.js';
import { receiveUpload } from '#lib/server/upload-receiver.js';
import type { RequestHandler } from './$types';

/**
 * One piece of a photo or video published from Lightroom (see upload-receiver.ts). With
 * `x-replace-photo`, a republished edit replaces that photo in place; if it has since been deleted
 * on the site, the file is added as a new photo instead.
 */
export const POST: RequestHandler = async (event) => {
	requireToken(event);
	const album = requireAlbumId(event.params.id);
	const replacing = photoToReplace(album.id, event.request.headers.get('x-replace-photo'));
	return receiveUpload(event.request, async (file, name, type) => {
		const row = replacing
			? await replacePhoto(replacing, file, name, type)
			: getPhoto((await addPhoto(album.id, file, name, type)).id)!;
		return Response.json({ photo: photoSummary(event.url.origin, row) });
	});
};
