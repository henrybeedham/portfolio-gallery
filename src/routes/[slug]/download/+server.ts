import { error, type RequestEvent } from '@sveltejs/kit';
import { getAlbumBySlug } from '#lib/server/albums.js';
import { albumAccess } from '#lib/server/access.js';
import { recordZipDownload } from '#lib/server/analytics.js';
import { isContinuation } from '#lib/server/files.js';
import { photosForAlbum } from '#lib/server/photos.js';
import { photoZipFiles, zipName, zipResponse } from '#lib/server/zip.js';

function parseIds(value: unknown): number[] | null {
	if (value === null || value === undefined || value === '') return null;
	const list = Array.isArray(value) ? value : String(value).split(',');
	const ids = list.map((v) => Math.floor(Number(v))).filter((n) => Number.isInteger(n) && n > 0);
	return [...new Set(ids)];
}

async function respond(event: RequestEvent, ids: number[] | null) {
	const { params, cookies, locals, url } = event;
	const album = getAlbumBySlug(params.slug!);
	if (!album) error(404, 'Gallery not found');
	if (albumAccess(album, { cookies, isAdmin: locals.isAdmin }) !== 'ok') {
		error(403, 'This gallery is not available');
	}

	const rows = photosForAlbum(album.id, ids ?? undefined);
	if (!rows.length) error(404, 'There are no photos to download');

	// A resumed download is the same download, so it isn't counted again.
	if (!locals.isAdmin && !isContinuation(event.request)) {
		recordZipDownload(album, ids ? rows.map((row) => row.id) : null, url.origin);
	}
	return zipResponse(
		event.request,
		photoZipFiles(rows),
		zipName(album.title, ids ? ' - selection' : '')
	);
}

/** Full album (or `?ids=1,2,3`) as a ZIP archive. */
export async function GET(event: RequestEvent) {
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
