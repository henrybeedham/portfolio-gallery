import { getFeaturedAlbum, listPublicAlbums, effectiveCoverId } from '#lib/server/albums.js';
import { isAlbumUnlocked } from '#lib/server/auth.js';
import { renderMarkdown } from '#lib/server/markdown.js';
import { orderedPhotoIds, photoItems, randomSeed } from '#lib/server/photos.js';
import type { PageServerLoad } from './$types';

const FEATURED_LIMIT = 24;

export const load: PageServerLoad = ({ cookies, locals }) => {
	const album = getFeaturedAlbum();
	let featured = null;

	if (album) {
		const locked = !locals.isAdmin && !!album.passwordHash && !isAlbumUnlocked(cookies, album);
		const view = {
			sort: album.sortOrder,
			tag: null,
			seed: album.sortOrder === 'random' ? randomSeed() : null
		};
		const ids = orderedPhotoIds(album.id, view);
		const coverId = effectiveCoverId(album.id);
		featured = {
			slug: album.slug,
			title: album.title,
			descriptionHtml: renderMarkdown(album.description),
			layout: album.layout,
			accentColor: album.accentColor,
			sortOrder: album.sortOrder,
			total: ids.length,
			locked,
			view,
			photos: locked ? [] : photoItems(ids.slice(0, FEATURED_LIMIT)),
			cover: locked && coverId ? (photoItems([coverId])[0] ?? null) : null
		};
	}

	return {
		featured,
		albums: listPublicAlbums('home')
	};
};
