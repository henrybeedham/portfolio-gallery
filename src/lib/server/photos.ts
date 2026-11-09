import fsp from 'node:fs/promises';
import { all, get, placeholders, run, transaction } from './db.js';
import {
	extractMetadata,
	generateVariants,
	moveFile,
	newKey,
	orientedSize,
	originalPath,
	removePhotoFiles
} from './images.js';
import { seededShuffle } from '#lib/sort.js';
import type { AdminPhoto, PhotoItem, SortOrder, Tag } from '#lib/types.js';

export interface PhotoRow {
	id: number;
	album_id: number;
	key: string;
	ext: string;
	original_name: string;
	mime: string;
	size: number;
	width: number;
	height: number;
	taken_at: string | null;
	downloads: number;
	version: number;
	created_at: string;
}

export const PAGE_SIZE = 48;

export function getPhoto(id: number) {
	return get<PhotoRow>('SELECT * FROM photos WHERE id = ?', id);
}

export function getPhotoByKey(key: string) {
	return get<PhotoRow>('SELECT * FROM photos WHERE key = ?', key);
}

/* ------------------------------------------------------------------ ordering */

export function randomSeed() {
	return Math.floor(Math.random() * 2_000_000_000) + 1;
}

const CHRONO = 'COALESCE(p.taken_at, p.created_at)';

/** The ordered photo ids for an album view (filter + sort), used for pagination and prev/next. */
export function orderedPhotoIds(
	albumId: number,
	view: { sort: SortOrder; tag: number | null; seed: number | null }
): number[] {
	const direction = view.sort === 'newest' ? 'DESC' : 'ASC';
	const join = view.tag ? 'JOIN photo_tags pt ON pt.photo_id = p.id AND pt.tag_id = ?' : '';
	const params = view.tag ? [view.tag, albumId] : [albumId];
	const rows = all<{ id: number }>(
		`SELECT p.id FROM photos p ${join} WHERE p.album_id = ? ORDER BY ${CHRONO} ${direction}, p.id ${direction}`,
		...params
	);
	const ids = rows.map((row) => row.id);
	return view.sort === 'random' ? seededShuffle(ids, view.seed ?? 1) : ids;
}

function toItem(row: PhotoRow): PhotoItem {
	return {
		id: row.id,
		key: row.key,
		v: row.version,
		w: row.width,
		h: row.height,
		name: row.original_name
	};
}

/** Loads photos by id, preserving the order of `ids`. */
export function photoItems(ids: number[]): PhotoItem[] {
	if (!ids.length) return [];
	const rows = all<PhotoRow>(
		`SELECT * FROM photos WHERE id IN (${placeholders(ids.length)})`,
		...ids
	);
	const byId = new Map(rows.map((row) => [row.id, row]));
	return ids
		.map((id) => byId.get(id))
		.filter((row): row is PhotoRow => !!row)
		.map(toItem);
}

export function adminPhotos(albumId: number): AdminPhoto[] {
	const rows = all<PhotoRow>(
		`SELECT * FROM photos p WHERE p.album_id = ? ORDER BY ${CHRONO} ASC, p.id ASC`,
		albumId
	);
	const tagRows = all<{ photo_id: number; tag_id: number }>(
		`SELECT pt.photo_id, pt.tag_id FROM photo_tags pt JOIN photos p ON p.id = pt.photo_id WHERE p.album_id = ?`,
		albumId
	);
	const tags = new Map<number, number[]>();
	for (const row of tagRows) {
		const list = tags.get(row.photo_id) ?? [];
		list.push(row.tag_id);
		tags.set(row.photo_id, list);
	}
	return rows.map((row) => ({
		...toItem(row),
		tags: tags.get(row.id) ?? [],
		size: row.size,
		downloads: row.downloads,
		takenAt: row.taken_at,
		createdAt: row.created_at
	}));
}

export function photosForAlbum(albumId: number, ids?: number[]): PhotoRow[] {
	if (ids) {
		if (!ids.length) return [];
		return all<PhotoRow>(
			`SELECT * FROM photos WHERE album_id = ? AND id IN (${placeholders(ids.length)})
			 ORDER BY ${CHRONO.replace(/p\./g, '')}, id`,
			albumId,
			...ids
		);
	}
	return all<PhotoRow>(
		`SELECT * FROM photos WHERE album_id = ? ORDER BY ${CHRONO.replace(/p\./g, '')}, id`,
		albumId
	);
}

/* ------------------------------------------------------------------- writes */

/**
 * Takes ownership of `tmpFile`, stores it as an original, generates thumbnails
 * and records it in the database.
 */
export async function addPhoto(
	albumId: number,
	tmpFile: string,
	originalName: string,
	mime: string,
	ext: string,
	options: { keepSourceOnFailure?: boolean } = {}
): Promise<AdminPhoto> {
	const key = newKey();
	const destination = originalPath(key, ext);
	await moveFile(tmpFile, destination);

	try {
		const [{ width, height }, metadata, stat] = await Promise.all([
			generateVariants(destination, key),
			extractMetadata(destination),
			fsp.stat(destination)
		]);

		const photoId = transaction(() => {
			const result = run(
				`INSERT INTO photos (album_id, key, ext, original_name, mime, size, width, height, taken_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				albumId,
				key,
				ext,
				originalName,
				mime,
				stat.size,
				width,
				height,
				metadata.takenAt
			);
			tagWithKeywords(albumId, result.lastInsertRowid, metadata.keywords);
			return result.lastInsertRowid;
		});
		const row = getPhoto(photoId)!;
		return {
			...toItem(row),
			tags: all<{ tag_id: number }>('SELECT tag_id FROM photo_tags WHERE photo_id = ?', row.id).map(
				(tag) => tag.tag_id
			),
			size: row.size,
			downloads: 0,
			takenAt: row.taken_at,
			createdAt: row.created_at
		};
	} catch (error) {
		if (options.keepSourceOnFailure) await moveFile(destination, tmpFile).catch(() => {});
		await removePhotoFiles(key, ext);
		throw error;
	}
}

export async function deletePhotos(albumId: number, ids: number[]) {
	const rows = photosForAlbum(albumId, ids);
	if (!rows.length) return 0;
	transaction(() => {
		const list = rows.map((row) => row.id);
		run(
			`UPDATE albums SET cover_photo_id = NULL WHERE id = ? AND cover_photo_id IN (${placeholders(list.length)})`,
			albumId,
			...list
		);
		run(
			`UPDATE albums SET background_photo_id = NULL WHERE id = ? AND background_photo_id IN (${placeholders(list.length)})`,
			albumId,
			...list
		);
		run(`DELETE FROM photos WHERE id IN (${placeholders(list.length)})`, ...list);
	});
	await Promise.all(rows.map((row) => removePhotoFiles(row.key, row.ext)));
	return rows.length;
}

export async function deleteAlbum(albumId: number) {
	const rows = photosForAlbum(albumId);
	run('DELETE FROM albums WHERE id = ?', albumId);
	for (const row of rows) await removePhotoFiles(row.key, row.ext);
}

export function bumpVersion(photoId: number, fields: { width: number; height: number }) {
	run(
		'UPDATE photos SET version = version + 1, width = ?, height = ? WHERE id = ?',
		fields.width,
		fields.height,
		photoId
	);
}

export async function refreshMetadata(row: PhotoRow) {
	const file = originalPath(row.key, row.ext);
	const [metadata, stat, size] = await Promise.all([
		extractMetadata(file),
		fsp.stat(file),
		orientedSize(file)
	]);
	transaction(() => {
		run(
			'UPDATE photos SET size = ?, width = ?, height = ?, taken_at = ? WHERE id = ?',
			stat.size,
			size.width,
			size.height,
			metadata.takenAt,
			row.id
		);
		tagWithKeywords(row.album_id, row.id, metadata.keywords);
	});
}

/* --------------------------------------------------------------------- tags */

export function albumTags(albumId: number): Tag[] {
	return all<Tag>(
		'SELECT id, name FROM tags WHERE album_id = ? ORDER BY name COLLATE NOCASE',
		albumId
	);
}

export function createTag(albumId: number, name: string): Tag {
	const existing = get<Tag>(
		'SELECT id, name FROM tags WHERE album_id = ? AND name = ? COLLATE NOCASE',
		albumId,
		name
	);
	if (existing) return existing;
	const result = run('INSERT INTO tags (album_id, name) VALUES (?, ?)', albumId, name);
	return { id: result.lastInsertRowid, name };
}

/**
 * Applies a photo's embedded keywords as album tags, creating any the album doesn't have yet.
 * Only ever adds: tags applied by hand, or keywords since removed in Lightroom, are left alone.
 */
function tagWithKeywords(albumId: number, photoId: number, keywords: string[]) {
	for (const name of keywords) {
		const tag = createTag(albumId, name);
		run('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id) VALUES (?, ?)', photoId, tag.id);
	}
}

export function deleteTag(albumId: number, tagId: number) {
	run('DELETE FROM tags WHERE id = ? AND album_id = ?', tagId, albumId);
}

export function setTag(albumId: number, tagId: number, photoIds: number[], applied: boolean) {
	const tag = get<{ id: number }>(
		'SELECT id FROM tags WHERE id = ? AND album_id = ?',
		tagId,
		albumId
	);
	if (!tag || !photoIds.length) return;
	const valid = photosForAlbum(albumId, photoIds).map((row) => row.id);
	transaction(() => {
		for (const id of valid) {
			if (applied) {
				run('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id) VALUES (?, ?)', id, tagId);
			} else {
				run('DELETE FROM photo_tags WHERE photo_id = ? AND tag_id = ?', id, tagId);
			}
		}
	});
}
