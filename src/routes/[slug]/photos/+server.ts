import { error } from '@sveltejs/kit';
import { getAlbumBySlug } from '#lib/server/albums.js';
import { albumAccess } from '#lib/server/access.js';
import { albumTags, orderedPhotoIds, PAGE_SIZE, photoItems } from '#lib/server/photos.js';
import { parseView } from '#lib/server/view.js';
import type { RequestHandler } from './$types';

/** Paginated photo listing for "Load More", or the full id list when selecting everything. */
export const GET: RequestHandler = ({ params, url, cookies, locals }) => {
	const album = getAlbumBySlug(params.slug);
	if (!album) error(404, 'Gallery not found');
	const preview = locals.isAdmin && url.searchParams.has('preview');
	if (albumAccess(album, { cookies, isAdmin: locals.isAdmin, preview }) !== 'ok') {
		error(403, 'This gallery is not available');
	}

	const view = parseView(url, album, albumTags(album.id));
	const ids = orderedPhotoIds(album.id, view);

	if (url.searchParams.has('ids')) {
		return Response.json({ ids, total: ids.length });
	}

	const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0));
	const limit = Math.min(
		200,
		Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || PAGE_SIZE))
	);
	return Response.json(
		{ photos: photoItems(ids.slice(offset, offset + limit)), total: ids.length },
		{ headers: { 'cache-control': 'private, no-store' } }
	);
};
