import fsp from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import { effectiveCoverId, getAlbumById, isIndexable, type Album } from '#lib/server/albums.js';
import { albumAccess } from '#lib/server/access.js';
import { recordPhotoDownload } from '#lib/server/analytics.js';
import { isContinuation, serveFile } from '#lib/server/files.js';
import { originalPath, previewPath, variantPath } from '#lib/server/images.js';
import { getPhotoByKey, regenerateVariants, type PhotoRow } from '#lib/server/photos.js';
import { queuePreview } from '#lib/server/video-preview.js';
import { contentDisposition } from '#lib/server/zip.js';
import type { RequestHandler } from './$types';

const VARIANTS = new Set(['thumb', 'medium', 'preview', 'original']);

async function exists(file: string) {
	try {
		await fsp.access(file);
		return true;
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async (event) => {
	if (!VARIANTS.has(event.params.variant)) error(404, 'Not found');
	const photo = getPhotoByKey(event.params.key);
	if (!photo) error(404, 'Not found');
	const album = getAlbumById(photo.album_id);
	if (!album) error(404, 'Not found');

	const response = await serve(event, photo, album);
	// Keeps photos from link-only albums out of image search, as their pages are.
	if (!isIndexable(album)) response.headers.set('x-robots-tag', 'noindex');
	return response;
};

async function serve(
	{ params, request, url, cookies, locals }: Parameters<RequestHandler>[0],
	photo: PhotoRow,
	album: Album
): Promise<Response> {
	const variant = params.variant;
	const access = albumAccess(album, { cookies, isAdmin: locals.isAdmin });
	if (access !== 'ok') {
		// Password-protected albums still show their cover on public listings.
		const coverAllowed =
			access === 'locked' &&
			(variant === 'thumb' || variant === 'medium') &&
			effectiveCoverId(album.id) === photo.id;
		if (!coverAllowed) error(404, 'Not found');
	}

	const shareable = album.isPublic && !album.passwordHash && !album.expiresAt;
	const cacheControl = `${shareable ? 'public' : 'private'}, max-age=31536000, immutable`;

	if (variant === 'preview') {
		if (photo.kind !== 'video') error(404, 'Not found');
		// Like originals, never kept by shared caches.
		const response = await serveFile(request, previewPath(photo.key), {
			type: 'video/mp4',
			cacheControl: 'private, max-age=31536000, immutable'
		});
		if (response) return response;
		// Gone missing: make it again, and play the original meanwhile.
		queuePreview(photo.id, { force: true });
		const fallback = await serveFile(request, originalPath(photo.key, photo.ext), {
			type: photo.mime,
			cacheControl: 'private, no-store'
		});
		if (!fallback) error(404, 'Video is missing');
		return fallback;
	}

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
}
