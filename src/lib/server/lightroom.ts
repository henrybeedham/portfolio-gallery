/**
 * The API the Lightroom Classic plugin uses (routes under /api/lightroom). Requests carry an API
 * token as `Authorization: Bearer …`; see api-tokens.ts.
 */
import { error, type RequestEvent } from '@sveltejs/kit';
import { createAlbum, getAlbumById, listAdminAlbums, validateSlug } from './albums.js';
import { verifyApiToken } from './api-tokens.js';
import { getBooking, linkAlbum, listBookings } from './bookings.js';
import { getPhoto, type PhotoRow } from './photos.js';
import { clientIp, rateLimit } from './ratelimit.js';
import { getSettings } from './settings.js';
import { hasTheme } from './themes.js';
import { addDays, formatJobDate, slugify, todayIso } from '#lib/utils.js';

/** Throws 401 unless the request has a valid token. Repeated failures from one address get 429. */
export function requireToken(event: RequestEvent) {
	const header = event.request.headers.get('authorization') ?? '';
	const token = /^Bearer\s+(\S+)$/i.exec(header)?.[1] ?? '';
	if (token && verifyApiToken(token)) return;
	if (!rateLimit(`api-token:${clientIp(event)}`, 20, 10 * 60 * 1000)) {
		error(429, 'Too many failed attempts. Try again in a few minutes.');
	}
	error(401, 'The token is missing, wrong or has been revoked. Make a new one under Lightroom.');
}

export function albumSummary(origin: string, id: number) {
	const album = listAdminAlbums().find((a) => a.id === id);
	if (!album) error(404, 'Album not found');
	return {
		id: album.id,
		title: album.title,
		slug: album.slug,
		isPublic: album.isPublic,
		count: album.count,
		url: `${origin}/${album.slug}`,
		adminUrl: `${origin}/admin/albums/${album.id}`
	};
}

export function albumList(origin: string) {
	return listAdminAlbums().map((album) => ({
		id: album.id,
		title: album.title,
		slug: album.slug,
		isPublic: album.isPublic,
		count: album.count,
		url: `${origin}/${album.slug}`,
		adminUrl: `${origin}/admin/albums/${album.id}`
	}));
}

/** Jobs worth offering when a collection is set up: recent and upcoming ones, newest first. */
export function jobList() {
	const since = addDays(todayIso(), -120);
	return listBookings()
		.filter((b) => b.status !== 'cancelled' && (!b.startsAt || b.startsAt.slice(0, 10) >= since))
		.reverse()
		.map((b) => ({
			id: b.id,
			title: b.title,
			client: b.client,
			date: formatJobDate(b.startsAt).day,
			hasAlbum: b.albums.length > 0
		}));
}

function uniqueSlug(title: string) {
	const base = slugify(title) || 'album';
	for (let n = 1; n < 1000; n++) {
		const slug = n === 1 ? base : `${base}-${n}`;
		if (!validateSlug(slug)) return slug;
	}
	error(409, 'Could not find a free address for the album.');
}

/** A new album with the defaults from Settings, optionally linked to a job. */
export function createAlbumFor(input: {
	title: string;
	jobId?: number | null;
	isPublic?: boolean;
}) {
	const settings = getSettings();
	const title = input.title.trim().slice(0, 200) || 'Untitled';
	const job = input.jobId ? getBooking(input.jobId) : undefined;
	if (input.jobId && !job) error(404, 'Job not found');
	const id = createAlbum({
		title,
		slug: uniqueSlug(title),
		description: settings.defaultDescription,
		albumDate: job?.startsAt?.slice(0, 10) ?? null,
		isPublic: input.isPublic ?? settings.defaultPublic,
		showOnHome: settings.defaultShowOnHome,
		showOnGalleries: settings.defaultShowOnGalleries,
		isFeatured: false,
		passwordHash: null,
		expiresAt: null,
		theme: hasTheme(settings.defaultAlbumTheme) ? settings.defaultAlbumTheme : null,
		layout: settings.defaultLayout,
		sortOrder: settings.defaultSort,
		sectionsCollapsed: false
	});
	if (job) linkAlbum(job.id, id);
	return id;
}

export function requireAlbumId(id: string) {
	const album = getAlbumById(Number(id));
	if (!album) error(404, 'This gallery no longer exists on the site.');
	return album;
}

export function photoSummary(origin: string, row: PhotoRow) {
	const album = getAlbumById(row.album_id)!;
	return { id: row.id, url: `${origin}/${album.slug}/photo/${row.id}` };
}

/** The photo to replace, if it's still in this album. */
export function photoToReplace(albumId: number, header: string | null) {
	const id = Number(header);
	if (!header || !Number.isSafeInteger(id)) return undefined;
	const row = getPhoto(id);
	return row && row.album_id === albumId ? row : undefined;
}
