import { error, redirect } from '@sveltejs/kit';
import { getAlbumBySlug } from '#lib/server/albums.js';
import { albumAccess } from '#lib/server/access.js';
import { albumTags, getPhoto, orderedPhotoIds, photoItems } from '#lib/server/photos.js';
import { albumPageTheme } from '#lib/server/themes.js';
import { parseView } from '#lib/server/view.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url, cookies, locals }) => {
	const album = getAlbumBySlug(params.slug);
	if (!album) error(404, 'Gallery not found');

	const access = albumAccess(album, { cookies, isAdmin: locals.isAdmin });
	if (access === 'not_found') error(404, 'Gallery not found');
	if (access !== 'ok') redirect(303, `/${album.slug}`);

	const photo = getPhoto(Number(params.id));
	if (!photo || photo.album_id !== album.id) error(404, 'Photo not found');

	const view = parseView(url, album, albumTags(album.id));
	let ids = orderedPhotoIds(album.id, view);
	let index = ids.indexOf(photo.id);
	if (index === -1) {
		// The photo isn't in the active tag filter; fall back to the whole album.
		view.tag = null;
		ids = orderedPhotoIds(album.id, view);
		index = ids.indexOf(photo.id);
	}

	// The photo and its neighbours, so the viewer can warm up and step to them.
	const offset = Math.max(0, index - 1);

	return {
		theme: albumPageTheme(locals, album),
		album: {
			id: album.id,
			slug: album.slug,
			title: album.title,
			sortOrder: album.sortOrder,
			hasPassword: !!album.passwordHash,
			isPublic: album.isPublic
		},
		photos: photoItems(ids.slice(offset, index + 2)),
		index,
		offset,
		total: ids.length,
		view,
		from: url.searchParams.get('from') === 'home' ? ('home' as const) : null,
		origin: url.origin
	};
};
