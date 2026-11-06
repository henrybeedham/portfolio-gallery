import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import yazl from 'yazl';
import { originalPath } from './images.js';
import type { PhotoRow } from './photos.js';

export function contentDisposition(filename: string, type: 'attachment' | 'inline' = 'attachment') {
	const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function uniqueNames(rows: PhotoRow[]) {
	const used = new Map<string, number>();
	return rows.map((row) => {
		const clean = row.original_name.replace(/[/\\]/g, '_') || `${row.key}.${row.ext}`;
		const lower = clean.toLowerCase();
		const count = used.get(lower) ?? 0;
		used.set(lower, count + 1);
		if (count === 0) return clean;
		const ext = path.extname(clean);
		return `${clean.slice(0, clean.length - ext.length)} (${count + 1})${ext}`;
	});
}

/**
 * Streams the originals as an uncompressed ZIP (photos don't compress further),
 * which lets us send an exact Content-Length so browsers can show progress.
 */
export async function zipResponse(rows: PhotoRow[], filename: string): Promise<Response> {
	const zip = new yazl.ZipFile();
	const names = uniqueNames(rows);

	const entries = await Promise.all(
		rows.map(async (row, index) => {
			const file = originalPath(row.key, row.ext);
			try {
				const stat = await fsp.stat(file);
				return { file, name: names[index], size: stat.size, mtime: stat.mtime };
			} catch {
				return null;
			}
		})
	);

	for (const entry of entries) {
		if (!entry) continue;
		zip.addReadStreamLazy(
			entry.name,
			{ size: entry.size, mtime: entry.mtime, compress: false },
			(callback) => callback(null, fs.createReadStream(entry.file))
		);
	}

	// @types/yazl omits the size argument that yazl passes to this callback.
	const end = zip.end.bind(zip) as (options: object, callback: (total: number) => void) => void;
	const size = await new Promise<number>((resolve) => end({}, resolve));

	const headers = new Headers({
		'content-type': 'application/zip',
		'content-disposition': contentDisposition(filename),
		'cache-control': 'no-store'
	});
	if (size > 0) headers.set('content-length', String(size));

	const body = Readable.toWeb(zip.outputStream as Readable) as ReadableStream<Uint8Array>;
	return new Response(body, { headers });
}

export function zipName(title: string, suffix = '') {
	// Strip only characters that are invalid in filenames on common systems.
	const base =
		title
			.replace(/[/\\:*?"<>|\u0000-\u001f]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim() || 'gallery';
	return `${base}${suffix}.zip`;
}
