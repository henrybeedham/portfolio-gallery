import { error, fail, redirect } from '@sveltejs/kit';
import {
	albumIsExpired,
	albumPhotoStats,
	getAlbumById,
	getAlbumBySlug,
	type Album
} from '#lib/server/albums.js';
import { albumAccess } from '#lib/server/access.js';
import { unlockAlbum, verifyPassword } from '#lib/server/auth.js';
import { recordView } from '#lib/server/analytics.js';
import { renderMarkdown } from '#lib/server/markdown.js';
import { albumTags, getPhoto, orderedPhotoIds, PAGE_SIZE, photoItems } from '#lib/server/photos.js';
import { clientIp, rateLimit } from '#lib/server/ratelimit.js';
import { getSettings } from '#lib/server/settings.js';
import { parseView } from '#lib/server/view.js';
import type { Actions, PageServerLoad } from './$types';

function publicAlbum(album: Album) {
	return {
		id: album.id,
		slug: album.slug,
		title: album.title,
		albumDate: album.albumDate,
		expiresAt: album.expiresAt,
		accentColor: album.accentColor,
		layout: album.layout,
		sortOrder: album.sortOrder,
		hasPassword: !!album.passwordHash,
		isPublic: album.isPublic
	};
}

function contact() {
	const settings = getSettings();
	return { email: settings.contactEmail, phone: settings.contactPhone };
}

export const load: PageServerLoad = (event) => {
	const { params, url, cookies, locals, request } = event;
	const album = getAlbumBySlug(params.slug);
	if (!album) error(404, 'Gallery not found');

	const preview = locals.isAdmin && url.searchParams.has('preview');
	const access = albumAccess(album, { cookies, isAdmin: locals.isAdmin, preview });

	if (access === 'not_found') error(404, 'Gallery not found');

	const base = {
		album: publicAlbum(album),
		preview,
		expired: albumIsExpired(album)
	};

	if (access === 'expired') {
		return { ...base, status: 'expired' as const, contact: contact() };
	}

	if (access === 'locked') {
		return { ...base, status: 'locked' as const };
	}

	if (!locals.isAdmin) recordView(album, clientIp(event), request.headers.get('user-agent'));

	const tags = albumTags(album.id);
	const view = parseView(url, album, tags);
	const ids = orderedPhotoIds(album.id, view);
	const stats = albumPhotoStats(album.id);
	const background = album.backgroundPhotoId ? getPhoto(album.backgroundPhotoId) : undefined;

	return {
		...base,
		status: 'ok' as const,
		descriptionHtml: renderMarkdown(album.description),
		tags,
		view,
		photos: photoItems(ids.slice(0, PAGE_SIZE)),
		total: ids.length,
		albumCount: stats.count,
		albumBytes: stats.bytes,
		background:
			background && background.album_id === album.id
				? { key: background.key, v: background.version, w: background.width, h: background.height }
				: null
	};
};

export const actions: Actions = {
	unlock: async (event) => {
		const { request, params, cookies, url } = event;
		const album = getAlbumBySlug(params.slug);
		if (!album || !album.passwordHash) redirect(303, `/${params.slug}`);

		// Per visitor, plus a ceiling per album so guessing from many addresses stays slow.
		if (
			!rateLimit(`unlock:${clientIp(event)}:${album.id}`, 10, 5 * 60 * 1000) ||
			!rateLimit(`unlock-album:${album.id}`, 200, 60 * 60 * 1000)
		) {
			return fail(429, { error: 'Too many attempts. Please wait a few minutes and try again.' });
		}

		const data = await request.formData();
		const password = String(data.get('password') ?? '');
		// Re-read in case the album changed between render and submit.
		const current = getAlbumById(album.id)!;
		if (!password || !(await verifyPassword(password, current.passwordHash))) {
			return fail(400, { error: 'That password is incorrect. Please try again.' });
		}

		unlockAlbum({ cookies, url }, current);
		const next = String(data.get('next') ?? '');
		redirect(303, next.startsWith(`/${album.slug}`) ? next : `/${album.slug}`);
	}
};
