import fsp from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { setAlbumImage } from '#lib/server/albums.js';
import { clearAnalytics } from '#lib/server/analytics.js';
import { importDir } from '#lib/server/config.js';
import { requireAdmin, requireAlbum } from '#lib/server/guard.js';
import { typeFromFilename } from '#lib/server/images.js';
import { startJob } from '#lib/server/jobs.js';
import {
	addPhoto,
	bumpVersion,
	createTag,
	deletePhotos,
	deleteAlbum,
	deleteTag,
	detectMedia,
	getPhoto,
	photosForAlbum,
	refreshMetadata,
	regenerateVariants,
	setTag
} from '#lib/server/photos.js';
import type { Album } from '#lib/server/albums.js';
import type { RequestHandler } from './$types';

function ids(value: unknown): number[] {
	if (!Array.isArray(value)) return [];
	return [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
}

/** The album's own subfolder of the import directory if it exists, otherwise the import directory itself. */
async function importSource(album: Album) {
	const own = path.join(importDir, album.slug);
	try {
		if ((await fsp.stat(own)).isDirectory()) return own;
	} catch {
		// no album-specific folder
	}
	return importDir;
}

async function importableFiles(dir: string) {
	try {
		const entries = await fsp.readdir(dir, { withFileTypes: true });
		return entries
			.filter(
				(entry) => entry.isFile() && !entry.name.startsWith('.') && typeFromFilename(entry.name)
			)
			.map((entry) => entry.name)
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
	} catch {
		return [];
	}
}

export const POST: RequestHandler = async ({ request, params, locals }) => {
	requireAdmin(locals);
	const album = requireAlbum(params.id);
	const body = await request.json().catch(() => null);
	if (!body || typeof body.action !== 'string') error(400, 'Missing action');

	switch (body.action) {
		case 'delete-photos': {
			const deleted = await deletePhotos(album.id, ids(body.ids));
			return Response.json({ deleted });
		}

		case 'set-cover':
		case 'set-background': {
			const field = body.action === 'set-cover' ? 'cover' : 'background';
			const photoId = body.photoId === null ? null : Number(body.photoId);
			if (photoId !== null) {
				const photo = getPhoto(photoId);
				if (!photo || photo.album_id !== album.id) error(404, 'Photo not found');
			}
			setAlbumImage(album.id, field, photoId);
			return Response.json({ ok: true });
		}

		case 'create-tag': {
			const name = String(body.name ?? '')
				.trim()
				.slice(0, 60);
			if (!name) error(400, 'Tag name is required');
			return Response.json({ tag: createTag(album.id, name) });
		}

		case 'delete-tag': {
			deleteTag(album.id, Number(body.tagId));
			return Response.json({ ok: true });
		}

		case 'tag-photos': {
			setTag(album.id, Number(body.tagId), ids(body.ids), body.applied !== false);
			return Response.json({ ok: true });
		}

		case 'clear-analytics': {
			clearAnalytics(album.id);
			return Response.json({ ok: true });
		}

		case 'regenerate': {
			const job = startJob({
				albumId: album.id,
				kind: 'regenerate',
				label: 'Regenerating thumbnails',
				items: photosForAlbum(album.id),
				worker: async (row) => {
					bumpVersion(row.id, await regenerateVariants(row));
				}
			});
			return Response.json({ job });
		}

		case 'refresh-metadata': {
			const job = startJob({
				albumId: album.id,
				kind: 'metadata',
				label: 'Re-extracting metadata',
				items: photosForAlbum(album.id),
				concurrency: 4,
				worker: (row) => refreshMetadata(row)
			});
			return Response.json({ job });
		}

		case 'import-scan': {
			const dir = await importSource(album);
			const files = await importableFiles(dir);
			return Response.json({ dir, files: files.length, sample: files.slice(0, 8) });
		}

		case 'import': {
			const dir = await importSource(album);
			const files = await importableFiles(dir);
			const job = startJob({
				albumId: album.id,
				kind: 'import',
				label: 'Importing from server folder',
				items: files,
				worker: async (name) => {
					const file = path.join(dir, name);
					const type = await detectMedia(file);
					if (!type) throw new Error(`${name} isn’t a supported photo or video`);
					await addPhoto(album.id, file, name, type, { keepSourceOnFailure: true });
				}
			});
			return Response.json({ job });
		}

		default:
			error(400, 'Unknown action');
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireAdmin(locals);
	const album = requireAlbum(params.id);
	await deleteAlbum(album.id);
	return Response.json({ ok: true });
};
