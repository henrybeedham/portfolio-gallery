import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { finished, pipeline, Readable, Transform } from 'node:stream';
import zlib from 'node:zlib';
import yazl from 'yazl';
import { requestedRange } from './files.js';
import { originalPath } from './images.js';
import type { PhotoRow } from './photos.js';

const require = createRequire(import.meta.url);

// yazl checksums every byte with a JavaScript CRC-32, which held ZIP downloads to about 500 MB/s.
// Node's native one gives the same result more than ten times faster.
require(require.resolve('buffer-crc32', { paths: [require.resolve('yazl')] })).unsigned = (
	data: Buffer,
	previous?: number
) => zlib.crc32(data, previous);

export function contentDisposition(filename: string, type: 'attachment' | 'inline' = 'attachment') {
	const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export interface ZipFile {
	/** Path inside the archive. */
	name: string;
	/** Path on disk. */
	file: string;
}

/**
 * Original files named as they were uploaded, with duplicates numbered. `folder` puts a file in a
 * folder of the archive (a section's title, say); it's cleaned up for use as a folder name.
 */
export function photoZipFiles(
	rows: PhotoRow[],
	folder?: (row: PhotoRow) => string | null
): ZipFile[] {
	const used = new Map<string, number>();
	return rows.map((row) => {
		// Names yazl refuses (a drive letter, or “..”) would fail the whole archive.
		const named = row.original_name.replace(/[/\\]/g, '_').replace(/^([a-zA-Z]):/, '$1_');
		const clean = named && named !== '..' ? named : `${row.key}.${row.ext}`;
		const dir = folder?.(row);
		const prefix = dir ? `${safeName(dir, 'Section')}/` : '';
		const lower = (prefix + clean).toLowerCase();
		const count = used.get(lower) ?? 0;
		used.set(lower, count + 1);
		const ext = path.extname(clean);
		const name = count
			? `${clean.slice(0, clean.length - ext.length)} (${count + 1})${ext}`
			: clean;
		return { name: prefix + name, file: originalPath(row.key, row.ext) };
	});
}

/** Drops the first `count` bytes of a stream. */
function skipBytes(source: Readable, count: number): Readable {
	let skipped = 0;
	const skipper = new Transform({
		transform(chunk: Buffer, _encoding, done) {
			if (skipped >= count) return done(null, chunk);
			const take = Math.min(count - skipped, chunk.length);
			skipped += take;
			done(null, take < chunk.length ? chunk.subarray(take) : undefined);
		}
	});
	return pipeline(source, skipper, () => {});
}

/**
 * Streams files as an uncompressed ZIP (photos and videos don't compress further), which lets us
 * send an exact Content-Length so browsers can show progress.
 *
 * The same files always produce the same bytes, so an interrupted download can resume from where it
 * stopped. Only ranges that run to the end are honoured (that's what browsers send): rebuilding the
 * archive up to a later range costs as much as sending it. Set `resumable: false` for archives
 * whose contents differ each time.
 */
export async function zipResponse(
	request: Request,
	files: ZipFile[],
	filename: string,
	options: { resumable?: boolean; onClose?: () => void } = {}
): Promise<Response> {
	const entries = (
		await Promise.all(
			files.map(async ({ name, file }) => {
				try {
					const stat = await fsp.stat(file);
					return stat.isFile() ? { name, file, size: stat.size, mtime: stat.mtime } : null;
				} catch {
					return null;
				}
			})
		)
	).filter((entry) => entry !== null);

	const zip = new yazl.ZipFile();
	for (const entry of entries) {
		zip.addReadStreamLazy(
			entry.name,
			{ size: entry.size, mtime: entry.mtime, compress: false },
			(callback) => callback(null, fs.createReadStream(entry.file, { highWaterMark: 1024 * 1024 }))
		);
	}
	if (options.onClose) finished(zip.outputStream, options.onClose);

	// @types/yazl omits the size argument that yazl passes to this callback.
	const end = zip.end.bind(zip) as (options: object, callback: (total: number) => void) => void;
	const size = await new Promise<number>((resolve) => end({}, resolve));

	const headers = new Headers({
		'content-type': 'application/zip',
		'content-disposition': contentDisposition(filename),
		'cache-control': 'no-store'
	});

	let body = zip.outputStream as Readable;
	let status = 200;
	let length = size;
	if (options.resumable !== false && size > 0) {
		const etag = `"zip-${crypto
			.createHash('sha1')
			.update(JSON.stringify(entries.map((e) => [e.name, e.size, e.mtime.getTime()])))
			.digest('base64url')}"`;
		headers.set('etag', etag);
		headers.set('accept-ranges', 'bytes');
		const range = requestedRange(request, size, [etag]);
		if (range && range !== 'unsatisfiable' && range.end === size - 1 && range.start > 0) {
			body = skipBytes(body, range.start);
			status = 206;
			length = size - range.start;
			headers.set('content-range', `bytes ${range.start}-${range.end}/${size}`);
		}
	}
	if (size > 0) headers.set('content-length', String(length));

	return new Response(Readable.toWeb(body) as ReadableStream<Uint8Array>, { status, headers });
}

/** Strips only characters that are invalid in filenames on common systems. */
function safeName(text: string, fallback: string) {
	return (
		text
			.replace(/[/\\:*?"<>|\u0000-\u001f]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			// Windows drops trailing dots and spaces from folder names.
			.replace(/[. ]+$/, '') || fallback
	);
}

export function zipName(title: string, suffix = '') {
	return `${safeName(title, 'gallery')}${safeName(suffix, '') && ` ${safeName(suffix, '')}`}.zip`;
}
