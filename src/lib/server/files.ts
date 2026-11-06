import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'node:stream';

/** Streams a file from disk with validators so browsers can revalidate cheaply. */
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

	const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
	const headers = new Headers({
		'content-type': options.type,
		'cache-control': options.cacheControl,
		etag,
		'last-modified': stat.mtime.toUTCString(),
		'x-content-type-options': 'nosniff'
	});
	if (options.disposition) headers.set('content-disposition', options.disposition);

	if (request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304, headers });
	}

	headers.set('content-length', String(stat.size));
	if (request.method === 'HEAD') return new Response(null, { headers });

	const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream<Uint8Array>;
	return new Response(stream, { headers });
}
