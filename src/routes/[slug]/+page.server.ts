import { error, fail, redirect } from '@sveltejs/kit';
import {
	albumIsExpired,
	albumPhotoCount,
	effectiveCoverId,
	getAlbumById,
	getAlbumBySlug,
	type Album
} from '#lib/server/albums.js';
import { albumAccess } from '#lib/server/access.js';
import { unlockAlbum, verifyPassword } from '#lib/server/auth.js';
import { renderMarkdown } from '#lib/server/markdown.js';
import { albumTags, getPhoto, orderedPhotos, PAGE_SIZE, photoItems } from '#lib/server/photos.js';
import { clientIp, rateLimit } from '#lib/server/ratelimit.js';
import { albumSections } from '#lib/server/sections.js';
import { getSettings } from '#lib/server/settings.js';
import { albumPageTheme } from '#lib/server/themes.js';
import { parseView } from '#lib/server/view.js';
import type { ViewSection } from '#lib/types.js';
import type { Actions, PageServerLoad } from './$types';

function publicAlbum(album: Album) {
	return {
		id: album.id,
		slug: album.slug,
		title: album.title,
		albumDate: album.albumDate,
		expiresAt: album.expiresAt,
		layout: album.layout,
		sortOrder: album.sortOrder,
		sectionsCollapsed: album.sectionsCollapsed,
		hasPassword: !!album.passwordHash,
		isPublic: album.isPublic
	};
}

const PREVIEW_COUNT = 6;

/** The album's sections that have photos in this view, with where each starts and a preview. */
function viewSections(
	albumId: number,
	ordered: { id: number; section: number | null }[]
): ViewSection[] {
	const found = new Map<number, { count: number; start: number; ids: number[] }>();
	ordered.forEach((row, index) => {
		if (row.section === null) return;
		const entry = found.get(row.section);
		if (!entry) found.set(row.section, { count: 1, start: index, ids: [row.id] });
		else {
			entry.count++;
			if (entry.ids.length < PREVIEW_COUNT) entry.ids.push(row.id);
		}
	});
	return albumSections(albumId).flatMap((section) => {
		const entry = found.get(section.id);
		if (!entry) return [];
		return [{ ...section, count: entry.count, start: entry.start, preview: photoItems(entry.ids) }];
	});
}

/** The cover for link previews; the media route serves it even while the album is locked. */
function shareImage(albumId: number) {
	const id = effectiveCoverId(albumId);
	const photo = id ? getPhoto(id) : undefined;
	return photo ? { key: photo.key, v: photo.version, w: photo.width, h: photo.height } : null;
}

function contact() {
	const settings = getSettings();
	return { email: settings.contactEmail, phone: settings.contactPhone };
}

export const load: PageServerLoad = (event) => {
	const { params, url, cookies, locals } = event;
	const album = getAlbumBySlug(params.slug);
	if (!album) error(404, 'Gallery not found');

	const preview = locals.isAdmin && url.searchParams.has('preview');
	const access = albumAccess(album, { cookies, isAdmin: locals.isAdmin, preview });

	if (access === 'not_found') error(404, 'Gallery not found');

	const base = {
		theme: albumPageTheme(locals, album),
		album: publicAlbum(album),
		preview,
		expired: albumIsExpired(album),
		origin: url.origin,
		shareImage: access === 'expired' ? null : shareImage(album.id)
	};

	if (access === 'expired') {
		return { ...base, status: 'expired' as const, contact: contact() };
	}

	if (access === 'locked') {
		return { ...base, status: 'locked' as const };
	}

	const tags = albumTags(album.id);
	const view = parseView(url, album, tags);
	const ordered = orderedPhotos(album.id, view);
	const ids = ordered.map((row) => row.id);
	const background = album.backgroundPhotoId ? getPhoto(album.backgroundPhotoId) : undefined;

	return {
		...base,
		status: 'ok' as const,
		descriptionHtml: renderMarkdown(album.description),
		tags,
		sections: viewSections(album.id, ordered),
		view,
		photos: photoItems(ids.slice(0, PAGE_SIZE)),
		total: ids.length,
		albumCount: albumPhotoCount(album.id),
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
