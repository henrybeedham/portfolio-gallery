import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { error } from '@sveltejs/kit';
import { paths } from '#lib/server/config.js';
import { requireAdmin, requireAlbum } from '#lib/server/guard.js';
import { addPhoto, detectMedia } from '#lib/server/photos.js';
import type { RequestHandler } from './$types';

const UPLOAD_ID = /^[a-f0-9]{32}$/;
const STALE_AFTER = 24 * 60 * 60 * 1000;

/** Uploads that were never finished, a day on. */
async function removeStaleUploads() {
	const cutoff = Date.now() - STALE_AFTER;
	for (const name of await fsp.readdir(paths.tmp).catch(() => [] as string[])) {
		if (!name.startsWith('upload-') || !name.endsWith('.part')) continue;
		const file = path.join(paths.tmp, name);
		const stat = await fsp.stat(file).catch(() => null);
		if (stat && stat.mtimeMs < cutoff) await fsp.rm(file, { force: true });
	}
}

/**
 * Receives a photo or video in pieces, so each request stays small (proxies such as Traefik limit
 * how long one may take) and an interrupted upload carries on where it stopped. Each piece is the
 * raw request body, with `x-upload-id` (32 hex characters, chosen by the browser), `x-upload-offset`,
 * `x-upload-size` (the whole file) and `x-filename` (URI encoded). A piece that doesn't start where
 * the last one ended gets 409 with the bytes received so far. The last piece returns the photo.
 */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	requireAdmin(locals);
	const album = requireAlbum(params.id);
	if (!request.body) error(400, 'Missing file');

	const id = request.headers.get('x-upload-id') ?? '';
	const offset = Number(request.headers.get('x-upload-offset'));
	const size = Number(request.headers.get('x-upload-size'));
	if (
		!UPLOAD_ID.test(id) ||
		!Number.isSafeInteger(offset) ||
		!Number.isSafeInteger(size) ||
		offset < 0 ||
		offset > size
	) {
		error(400, 'Invalid upload');
	}

	let name = 'photo';
	try {
		name = decodeURIComponent(request.headers.get('x-filename') ?? '') || name;
	} catch {
		// keep the default name
	}
	name = name.replace(/[/\\]/g, '_').slice(0, 255);

	await fsp.mkdir(paths.tmp, { recursive: true });
	const part = path.join(paths.tmp, `upload-${id}.part`);
	const received = async () => (await fsp.stat(part).catch(() => null))?.size ?? 0;
	if ((await received()) !== offset) {
		return Response.json({ received: await received() }, { status: 409 });
	}
	if (offset === 0) await removeStaleUploads();

	try {
		await pipeline(
			Readable.fromWeb(request.body as unknown as NodeReadableStream<Uint8Array>),
			fs.createWriteStream(part, { flags: offset ? 'a' : 'w' })
		);
	} catch {
		// The connection dropped part-way; the browser asks where to carry on from.
		return Response.json({ received: await received() }, { status: 409 });
	}

	const total = await received();
	if (total < size) return Response.json({ received: total });
	if (total > size) {
		await fsp.rm(part, { force: true });
		error(400, `${name} was larger than expected. Please upload it again.`);
	}

	try {
		const type = await detectMedia(part);
		if (!type) error(415, `${name} isn’t a supported photo or video`);
		const photo = await addPhoto(album.id, part, name, type);
		return Response.json({ photo });
	} catch (err) {
		await fsp.rm(part, { force: true });
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error(`[gallery] Upload of ${name} failed:`, err);
		error(422, `Could not process ${name}`);
	}
};
