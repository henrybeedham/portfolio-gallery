import { error, type RequestEvent } from '@sveltejs/kit';
import { getAlbumBySlug } from '#lib/server/albums.js';
import { albumAccess } from '#lib/server/access.js';
import { recordZipDownload } from '#lib/server/analytics.js';
import { isContinuation } from '#lib/server/files.js';
import { photosForAlbum, type PhotoRow } from '#lib/server/photos.js';
import { albumSections, getSection } from '#lib/server/sections.js';
import { photoZipFiles, zipName, zipResponse } from '#lib/server/zip.js';

function parseIds(value: unknown): number[] | null {
	if (value === null || value === undefined || value === '') return null;
	const list = Array.isArray(value) ? value : String(value).split(',');
	const ids = list.map((v) => Math.floor(Number(v))).filter((n) => Number.isInteger(n) && n > 0);
	return [...new Set(ids)];
}

/**
 * The whole album. When its photos are split between sections, each section's photos go in a
 * folder named after it, and photos without a section stay at the top level.
 */
function wholeAlbum(albumId: number) {
	const rows = photosForAlbum(albumId);
	const sections = albumSections(albumId);
	// Everything in one section (or none) is laid out flat, as if there were no sections.
	if (new Set(rows.map((row) => row.section_id ?? null)).size < 2) {
		return { rows, folder: undefined };
	}
	const order = new Map(sections.map((section, index) => [section.id, index]));
	const titles = new Map(sections.map((section) => [section.id, section.title]));
	const rank = (row: PhotoRow) => (row.section_id ? (order.get(row.section_id) ?? -1) : -1);
	// A stable sort keeps the date order within each folder.
	rows.sort((a, b) => rank(a) - rank(b));
	return {
		rows,
		folder: (row: PhotoRow) => (row.section_id ? (titles.get(row.section_id) ?? null) : null)
	};
}

/** One section of the album, as its own ZIP. */
async function respondSection(event: RequestEvent, sectionParam: string) {
	const { params, cookies, locals, url } = event;
	const album = getAlbumBySlug(params.slug!);
	if (!album) error(404, 'Gallery not found');
	if (albumAccess(album, { cookies, isAdmin: locals.isAdmin }) !== 'ok') {
		error(403, 'This gallery is not available');
	}
	const section = getSection(album.id, Math.floor(Number(sectionParam)));
	if (!section) error(404, 'Section not found');

	const rows = photosForAlbum(album.id).filter((row) => row.section_id === section.id);
	if (!rows.length) error(404, 'There are no photos to download');

	if (!locals.isAdmin && !isContinuation(event.request)) {
		recordZipDownload(
			album,
			rows.map((row) => row.id),
			url.origin,
			section.title
		);
	}
	return zipResponse(
		event.request,
		photoZipFiles(rows),
		zipName(album.title, `- ${section.title}`)
	);
}

async function respond(event: RequestEvent, ids: number[] | null) {
	const { params, cookies, locals, url } = event;
	const album = getAlbumBySlug(params.slug!);
	if (!album) error(404, 'Gallery not found');
	if (albumAccess(album, { cookies, isAdmin: locals.isAdmin }) !== 'ok') {
		error(403, 'This gallery is not available');
	}

	const { rows, folder } = ids
		? { rows: photosForAlbum(album.id, ids), folder: undefined }
		: wholeAlbum(album.id);
	if (!rows.length) error(404, 'There are no photos to download');

	// A resumed download is the same download, so it isn't counted again.
	if (!locals.isAdmin && !isContinuation(event.request)) {
		recordZipDownload(album, ids ? rows.map((row) => row.id) : null, url.origin);
	}
	return zipResponse(
		event.request,
		photoZipFiles(rows, folder),
		zipName(album.title, ids ? ' - selection' : '')
	);
}

/** Full album, one section (`?section=4`) or `?ids=1,2,3` as a ZIP archive. */
export async function GET(event: RequestEvent) {
	const section = event.url.searchParams.get('section');
	if (section) return respondSection(event, section);
	return respond(event, parseIds(event.url.searchParams.get('ids')));
}

/** Selected photos as a ZIP archive. Accepts JSON `{ ids: [] }` or a form field `ids=1,2,3`. */
export async function POST(event: RequestEvent) {
	const type = event.request.headers.get('content-type') ?? '';
	let ids: number[] | null;
	if (type.includes('application/json')) {
		const body = await event.request.json().catch(() => ({}));
		ids = parseIds(body?.ids);
	} else {
		const form = await event.request.formData();
		ids = parseIds(form.get('ids'));
	}
	if (!ids?.length) error(400, 'No photos selected');
	return respond(event, ids);
}
