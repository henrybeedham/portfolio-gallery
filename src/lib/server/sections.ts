/**
 * Album sections: named, ordered parts of one album, such as the days of a two-day shoot. Each
 * photo is in at most one. Photos without a section come first on the album page, with no
 * heading; the album's sort order applies within each section.
 */
import { all, get, placeholders, run, transaction } from './db.js';
import type { AdminSection, Section } from '#lib/types.js';

const SECTION_TITLE_MAX = 80;
const SECTION_DESCRIPTION_MAX = 500;

interface SectionRow {
	id: number;
	album_id: number;
	title: string;
	description: string;
	position: number;
}

function toSection(row: SectionRow): Section {
	return { id: row.id, title: row.title, description: row.description };
}

/** In display order. */
export function albumSections(albumId: number): Section[] {
	return all<SectionRow>(
		'SELECT * FROM sections WHERE album_id = ? ORDER BY position, id',
		albumId
	).map(toSection);
}

export function adminSections(albumId: number): AdminSection[] {
	return all<SectionRow & { count: number }>(
		`SELECT s.*, (SELECT COUNT(*) FROM photos p WHERE p.section_id = s.id) AS count
		 FROM sections s WHERE s.album_id = ? ORDER BY s.position, s.id`,
		albumId
	).map((row) => ({ ...toSection(row), count: row.count }));
}

export function getSection(albumId: number, sectionId: number): Section | undefined {
	const row = get<SectionRow>(
		'SELECT * FROM sections WHERE id = ? AND album_id = ?',
		sectionId,
		albumId
	);
	return row && toSection(row);
}

function clean(input: { title?: unknown; description?: unknown }) {
	return {
		title: String(input.title ?? '')
			.trim()
			.slice(0, SECTION_TITLE_MAX),
		description: String(input.description ?? '')
			.trim()
			.slice(0, SECTION_DESCRIPTION_MAX)
	};
}

/** Added at the end. Returns null when the title is empty. */
export function createSection(
	albumId: number,
	input: { title?: unknown; description?: unknown }
): Section | null {
	const { title, description } = clean(input);
	if (!title) return null;
	const { next } = get<{ next: number }>(
		'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM sections WHERE album_id = ?',
		albumId
	)!;
	const result = run(
		'INSERT INTO sections (album_id, title, description, position) VALUES (?, ?, ?, ?)',
		albumId,
		title,
		description,
		next
	);
	return { id: result.lastInsertRowid, title, description };
}

/** Returns false when the section isn't in the album or the title is empty. */
export function updateSection(
	albumId: number,
	sectionId: number,
	input: { title?: unknown; description?: unknown }
): boolean {
	const { title, description } = clean(input);
	if (!title) return false;
	return (
		run(
			'UPDATE sections SET title = ?, description = ? WHERE id = ? AND album_id = ?',
			title,
			description,
			sectionId,
			albumId
		).changes > 0
	);
}

/** The photos stay in the album, without a section. */
export function deleteSection(albumId: number, sectionId: number) {
	run('DELETE FROM sections WHERE id = ? AND album_id = ?', sectionId, albumId);
}

/** Sets the order from a list of the album's section ids; any left out keep their place after them. */
export function reorderSections(albumId: number, ids: number[]) {
	const current = albumSections(albumId).map((section) => section.id);
	const known = new Set(current);
	const listed = ids.filter((id) => known.has(id));
	const order = [...new Set(listed), ...current.filter((id) => !listed.includes(id))];
	transaction(() => {
		order.forEach((id, position) =>
			run('UPDATE sections SET position = ? WHERE id = ? AND album_id = ?', position, id, albumId)
		);
	});
}

/** Moves the album's photos into a section, or out of any with `null`. Returns how many moved. */
export function assignSection(albumId: number, sectionId: number | null, photoIds: number[]) {
	if (!photoIds.length) return 0;
	if (sectionId !== null && !getSection(albumId, sectionId)) return 0;
	return run(
		`UPDATE photos SET section_id = ? WHERE album_id = ? AND id IN (${placeholders(photoIds.length)})`,
		sectionId,
		albumId,
		...photoIds
	).changes;
}
