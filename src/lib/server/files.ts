import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'node:stream';

export interface ByteRange {
	start: number;
	end: number;
}

/**
 * The byte range a request asks for: null for the whole file, 'unsatisfiable' when it starts past
 * the end. Only single ranges are honoured; anything else gets the whole file, which HTTP allows.
 * `validators` are the file's current ETag and Last-Modified: a resumed download names the version
 * it started with in If-Range, and gets the whole file again if that has changed.
 */
export function requestedRange(
	request: Request,
	size: number,
	validators: string[]
): ByteRange | null | 'unsatisfiable' {
	const header = request.headers.get('range');
	if (!header) return null;
	const ifRange = request.headers.get('if-range');
	if (ifRange && !validators.includes(ifRange)) return null;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match || (!match[1] && !match[2])) return null;
	let start: number;
	let end = size - 1;
	if (!match[1]) {
		// A suffix range: the last N bytes.
		const length = Number(match[2]);
		if (!length) return 'unsatisfiable';
		start = Math.max(0, size - length);
	} else {
		start = Number(match[1]);
		if (match[2]) end = Math.min(Number(match[2]), size - 1);
	}
	if (start >= size || start > end) return 'unsatisfiable';
	return { start, end };
}

/** A request that picks a download up part-way through, which shouldn't count as a new download. */
export function isContinuation(request: Request) {
	return /^bytes=(?!0-)/.test(request.headers.get('range') ?? '');
}

/**
 * Streams a file from disk with validators so browsers can revalidate cheaply, and with byte ranges
 * so downloads can resume and videos can seek.
 */
export async function serveFile(
	request: Request,
	file: string,
	options: { type: string; cacheControl: string; disposition?: string }
): Promise<Response | null> {
	let stat: fs.Stats;
	try {
		stat = await fsp.stat(file);
	} catch {
		return null;
	}

	// Strong, so it can be used in If-Range.
	const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
	const lastModified = stat.mtime.toUTCString();
	const headers = new Headers({
		'content-type': options.type,
		'cache-control': options.cacheControl,
		etag,
		'last-modified': lastModified,
		'accept-ranges': 'bytes',
		'x-content-type-options': 'nosniff'
	});
	if (options.disposition) headers.set('content-disposition', options.disposition);

	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304, headers });
	}

	const range = requestedRange(request, stat.size, [etag, lastModified]);
	if (range === 'unsatisfiable') {
		headers.set('content-range', `bytes */${stat.size}`);
		return new Response(null, { status: 416, headers });
	}
	const { start, end } = range ?? { start: 0, end: stat.size - 1 };
	const status = range ? 206 : 200;
	headers.set('content-length', String(end - start + 1));
	if (range) headers.set('content-range', `bytes ${start}-${end}/${stat.size}`);
	if (request.method === 'HEAD' || stat.size === 0) return new Response(null, { status, headers });

	const stream = Readable.toWeb(
		fs.createReadStream(file, { start, end })
	) as ReadableStream<Uint8Array>;
	return new Response(stream, { status, headers });
}
