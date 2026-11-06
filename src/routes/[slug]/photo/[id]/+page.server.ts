import { error, redirect } from '@sveltejs/kit';
import { getAlbumBySlug } from '#lib/server/albums.js';
import { albumAccess } from '#lib/server/access.js';
import { albumTags, getPhoto, orderedPhotoIds, photoDetail } from '#lib/server/photos.js';
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

	return {
		album: {
			id: album.id,
			slug: album.slug,
			title: album.title,
			accentColor: album.accentColor,
			sortOrder: album.sortOrder,
			hasPassword: !!album.passwordHash,
			isPublic: album.isPublic
		},
		photo: photoDetail(photo),
		index,
		total: ids.length,
		prevId: index > 0 ? ids[index - 1] : null,
		nextId: index < ids.length - 1 ? ids[index + 1] : null,
		view,
		from: url.searchParams.get('from') === 'home' ? ('home' as const) : null,
		origin: url.origin
	};
};
