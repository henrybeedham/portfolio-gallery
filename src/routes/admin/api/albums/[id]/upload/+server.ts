import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { error } from '@sveltejs/kit';
import { requireAdmin, requireAlbum } from '#lib/server/guard.js';
import { detectType, tempFile } from '#lib/server/images.js';
import { addPhoto } from '#lib/server/photos.js';
import type { RequestHandler } from './$types';

/**
 * Receives a single image as the raw request body. The original filename is sent in the
 * `x-filename` header (URI encoded). The admin UI uploads files a few at a time.
 */
export const POST: RequestHandler = async ({ request, params, locals }) => {
	requireAdmin(locals);
	const album = requireAlbum(params.id);
	if (!request.body) error(400, 'Missing file');

	let name = 'photo';
	try {
		name = decodeURIComponent(request.headers.get('x-filename') ?? '') || name;
	} catch {
		// keep the default name
	}
	name = name.replace(/[/\\]/g, '_').slice(0, 255);

	const tmp = tempFile();
	try {
		await pipeline(
			Readable.fromWeb(request.body as unknown as NodeReadableStream<Uint8Array>),
			fs.createWriteStream(tmp)
		);
		const type = await detectType(tmp);
		if (!type) error(415, `${name} is not a JPEG, PNG, WebP or GIF image`);
		const photo = await addPhoto(album.id, tmp, name, type.mime, type.ext);
		return Response.json({ photo });
	} catch (err) {
		await fsp.rm(tmp, { force: true });
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error(`[gallery] Upload of ${name} failed:`, err);
		error(422, `Could not process ${name}`);
	}
};
