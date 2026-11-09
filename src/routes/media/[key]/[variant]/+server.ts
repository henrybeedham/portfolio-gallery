import fsp from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import { effectiveCoverId, getAlbumById } from '#lib/server/albums.js';
import { albumAccess } from '#lib/server/access.js';
import { recordPhotoDownload } from '#lib/server/analytics.js';
import { isContinuation, serveFile } from '#lib/server/files.js';
import { originalPath, variantPath } from '#lib/server/images.js';
import { getPhotoByKey, regenerateVariants } from '#lib/server/photos.js';
import { contentDisposition } from '#lib/server/zip.js';
import type { RequestHandler } from './$types';

const VARIANTS = new Set(['thumb', 'medium', 'original']);

async function exists(file: string) {
	try {
		await fsp.access(file);
		return true;
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async ({ params, request, url, cookies, locals }) => {
	const variant = params.variant;
	if (!VARIANTS.has(variant)) error(404, 'Not found');

	const photo = getPhotoByKey(params.key);
	if (!photo) error(404, 'Not found');
	const album = getAlbumById(photo.album_id);
	if (!album) error(404, 'Not found');

	const access = albumAccess(album, { cookies, isAdmin: locals.isAdmin });
	if (access !== 'ok') {
		// Password-protected albums still show their cover on public listings.
		const coverAllowed =
			access === 'locked' && variant !== 'original' && effectiveCoverId(album.id) === photo.id;
		if (!coverAllowed) error(404, 'Not found');
	}

	const shareable = album.isPublic && !album.passwordHash && !album.expiresAt;
	const cacheControl = `${shareable ? 'public' : 'private'}, max-age=31536000, immutable`;

	if (variant === 'original') {
		const download = url.searchParams.has('download');
		if (download && request.method === 'GET' && !locals.isAdmin && !isContinuation(request)) {
			recordPhotoDownload(album, photo, url.origin);
		}
		const response = await serveFile(request, originalPath(photo.key, photo.ext), {
			type: photo.mime,
			// Originals are never cached by shared caches, so they stop being served as soon as
			// the album is hidden or locked.
			cacheControl: download ? 'private, no-store' : 'private, max-age=31536000, immutable',
			disposition: contentDisposition(photo.original_name, download ? 'attachment' : 'inline')
		});
		if (!response) error(404, 'Original file is missing');
		return response;
	}

	const file = variantPath(photo.key, variant as 'thumb' | 'medium');
	const options = { type: 'image/webp', cacheControl };
	let response = await serveFile(request, file, options);
	if (!response) {
		// Regenerate on demand if a derivative went missing.
		const source = originalPath(photo.key, photo.ext);
		if (!(await exists(source))) error(404, 'Image is missing');
		await regenerateVariants(photo);
		response = await serveFile(request, file, options);
	}
	if (!response) error(404, 'Not found');
	return response;
};
