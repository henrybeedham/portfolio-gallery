import { all, get, run, transaction } from './db.js';
import { deliverJobsForAlbum } from './delivery.js';
import { getSettings } from './settings.js';
import type { AlbumCardData, ImageRef, Layout, SortOrder } from '#lib/types.js';
import { isExpired } from '#lib/utils.js';

export interface Album {
	id: number;
	title: string;
	slug: string;
	description: string;
	albumDate: string | null;
	isPublic: boolean;
	/** Listed on the homepage, which is also what lets search engines index it (`isIndexable`). */
	showOnHome: boolean;
	passwordHash: string | null;
	expiresAt: string | null;
	/** Theme id, or null to use the site's theme. */
	theme: string | null;
	layout: Layout;
	sortOrder: SortOrder;
	/** The album page opens with its sections collapsed to a few small previews. */
	sectionsCollapsed: boolean;
	coverPhotoId: number | null;
	backgroundPhotoId: number | null;
	views: number;
	photoDownloads: number;
	albumDownloads: number;
	createdAt: string;
	updatedAt: string;
}

interface AlbumRow {
	id: number;
	title: string;
	slug: string;
	description: string;
	album_date: string | null;
	is_public: number;
	show_on_home: number;
	password_hash: string | null;
	expires_at: string | null;
	theme: string | null;
	layout: string;
	sort_order: string;
	sections_collapsed: number;
	cover_photo_id: number | null;
	background_photo_id: number | null;
	views: number;
	photo_downloads: number;
	album_downloads: number;
	created_at: string;
	updated_at: string;
}

function mapAlbum(row: AlbumRow): Album {
	return {
		id: row.id,
		title: row.title,
		slug: row.slug,
		description: row.description,
		albumDate: row.album_date,
		isPublic: !!row.is_public,
		showOnHome: !!row.show_on_home,
		passwordHash: row.password_hash,
		expiresAt: row.expires_at,
		theme: row.theme,
		layout: row.layout === 'masonry' ? 'masonry' : 'grid',
		sortOrder: (['oldest', 'newest', 'random'].includes(row.sort_order)
			? row.sort_order
			: 'oldest') as SortOrder,
		sectionsCollapsed: !!row.sections_collapsed,
		coverPhotoId: row.cover_photo_id,
		backgroundPhotoId: row.background_photo_id,
		views: row.views,
		photoDownloads: row.photo_downloads,
		albumDownloads: row.album_downloads,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

const RESERVED_SLUGS = new Set([
	'admin',
	// Used for redirects from the previous gallery's /album/<slug> links.
	'album',
	'api',
	'galleries',
	'media',
	'site',
	'healthz',
	'_app',
	'favicon.svg',
	'robots.txt',
	'sitemap.xml'
]);

export function validateSlug(slug: string, exceptId?: number): string | null {
	if (!slug) return 'A URL slug is required.';
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
		return 'Use lowercase letters, numbers and single hyphens only.';
	if (RESERVED_SLUGS.has(slug)) return `“${slug}” is reserved. Please choose another slug.`;
	const existing = get<{ id: number }>('SELECT id FROM albums WHERE slug = ?', slug);
	if (existing && existing.id !== exceptId) return 'Another album already uses this slug.';
	return null;
}

export function getAlbumById(id: number): Album | undefined {
	const row = get<AlbumRow>('SELECT * FROM albums WHERE id = ?', id);
	return row && mapAlbum(row);
}

export function getAlbumBySlug(slug: string): Album | undefined {
	const row = get<AlbumRow>('SELECT * FROM albums WHERE slug = ?', slug);
	return row && mapAlbum(row);
}

export function albumIsExpired(album: Pick<Album, 'expiresAt'>) {
	return isExpired(album.expiresAt);
}

export type AlbumInput = Pick<
	Album,
	| 'title'
	| 'slug'
	| 'description'
	| 'albumDate'
	| 'isPublic'
	| 'showOnHome'
	| 'expiresAt'
	| 'theme'
	| 'layout'
	| 'sortOrder'
	| 'sectionsCollapsed'
> & { passwordHash: string | null };

export function createAlbum(input: AlbumInput): number {
	return transaction(() => {
		const result = run(
			`INSERT INTO albums (title, slug, description, album_date, is_public, show_on_home,
				password_hash, expires_at, theme, layout, sort_order, sections_collapsed)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			input.title,
			input.slug,
			input.description,
			input.albumDate,
			input.isPublic,
			input.showOnHome,
			input.passwordHash,
			input.expiresAt,
			input.theme,
			input.layout,
			input.sortOrder,
			input.sectionsCollapsed
		);
		return result.lastInsertRowid;
	});
}

export function updateAlbum(id: number, input: AlbumInput) {
	transaction(() => {
		run(
			`UPDATE albums SET title = ?, slug = ?, description = ?, album_date = ?, is_public = ?, show_on_home = ?,
				password_hash = ?, expires_at = ?, theme = ?, layout = ?,
				sort_order = ?, sections_collapsed = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			 WHERE id = ?`,
			input.title,
			input.slug,
			input.description,
			input.albumDate,
			input.isPublic,
			input.showOnHome,
			input.passwordHash,
			input.expiresAt,
			input.theme,
			input.layout,
			input.sortOrder,
			input.sectionsCollapsed,
			id
		);
		deliverJobsForAlbum(id);
	});
}

/** Makes an album public or private on its own, as from the album page's status notes. */
export function setAlbumPublic(id: number, isPublic: boolean) {
	transaction(() => {
		run(
			`UPDATE albums SET is_public = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
			isPublic,
			id
		);
		deliverJobsForAlbum(id);
	});
}

/** Changes just the title, as when a collection is renamed in Lightroom. The address stays. */
export function renameAlbum(id: number, title: string) {
	run(
		`UPDATE albums SET title = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
		title,
		id
	);
}

/** How many albums have chosen each theme (albums following the site's theme aren't counted). */
export function albumThemeCounts(): Map<string, number> {
	const rows = all<{ theme: string; n: number }>(
		'SELECT theme, COUNT(*) AS n FROM albums WHERE theme IS NOT NULL GROUP BY theme'
	);
	return new Map(rows.map((row) => [row.theme, row.n]));
}

export function setAlbumImage(id: number, field: 'cover' | 'background', photoId: number | null) {
	const column = field === 'cover' ? 'cover_photo_id' : 'background_photo_id';
	run(`UPDATE albums SET ${column} = ? WHERE id = ?`, photoId, id);
}

/** The explicit cover, or the earliest photo when none has been chosen. */
const EFFECTIVE_COVER = `COALESCE(
	(SELECT p.id FROM photos p WHERE p.id = a.cover_photo_id AND p.album_id = a.id),
	(SELECT p.id FROM photos p WHERE p.album_id = a.id ORDER BY COALESCE(p.taken_at, p.created_at), p.id LIMIT 1)
)`;

export function effectiveCoverId(albumId: number): number | null {
	const row = get<{ cover: number | null }>(
		`SELECT ${EFFECTIVE_COVER} AS cover FROM albums a WHERE a.id = ?`,
		albumId
	);
	return row?.cover ?? null;
}

interface ListingRow {
	id: number;
	slug: string;
	title: string;
	album_date: string | null;
	password_hash: string | null;
	expires_at: string | null;
	is_public: number;
	show_on_home: number;
	created_at: string;
	views: number;
	photo_downloads: number;
	album_downloads: number;
	count: number;
	cover_key: string | null;
	cover_v: number | null;
	cover_w: number | null;
	cover_h: number | null;
}

const LISTING_SQL = `
	SELECT a.id, a.slug, a.title, a.album_date, a.password_hash, a.expires_at, a.is_public, a.show_on_home,
		a.created_at, a.views, a.photo_downloads, a.album_downloads,
		(SELECT COUNT(*) FROM photos p WHERE p.album_id = a.id) AS count,
		c.key AS cover_key, c.version AS cover_v, c.width AS cover_w, c.height AS cover_h
	FROM albums a
	LEFT JOIN photos c ON c.id = ${EFFECTIVE_COVER}
`;

function coverOf(row: ListingRow): ImageRef | null {
	return row.cover_key
		? { key: row.cover_key, v: row.cover_v ?? 1, w: row.cover_w ?? 0, h: row.cover_h ?? 0 }
		: null;
}

function toCard(row: ListingRow): AlbumCardData {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		count: row.count,
		date: row.album_date,
		locked: !!row.password_hash,
		cover: coverOf(row)
	};
}

function sortByDate(a: ListingRow, b: ListingRow) {
	const da = a.album_date ?? a.created_at;
	const db = b.album_date ?? b.created_at;
	return db.localeCompare(da);
}

/** The albums listed on the homepage, newest first, leaving out the featured one shown above them. */
export function listHomeAlbums(): AlbumCardData[] {
	const featuredId = getSettings().featuredAlbumId;
	const rows = all<ListingRow>(`${LISTING_SQL} WHERE a.is_public = 1 AND a.show_on_home = 1`);
	return (
		rows
			.filter((row) => !isExpired(row.expires_at) && row.id !== featuredId)
			.sort(sortByDate)
			.map(toCard)
			// Don't reveal how many photos a password-protected album holds.
			.map((card) => (card.locked ? { ...card, count: null } : card))
	);
}

/** The album chosen under Settings → Homepage, if it's public and hasn't expired. */
export function getFeaturedAlbum(): Album | undefined {
	const id = getSettings().featuredAlbumId;
	if (id === null) return undefined;
	const row = get<AlbumRow>('SELECT * FROM albums WHERE id = ? AND is_public = 1', id);
	if (!row || isExpired(row.expires_at)) return undefined;
	return mapAlbum(row);
}

/**
 * Whether search engines may index an album: only ones a visitor can reach from the homepage (listed
 * there or featured), without a password, that haven't expired. Every other album, public or not,
 * is only for people who have its link, so it's sent with `noindex`.
 */
export function isIndexable(
	album: Pick<Album, 'id' | 'isPublic' | 'showOnHome' | 'passwordHash' | 'expiresAt'>
) {
	if (!album.isPublic || album.passwordHash || isExpired(album.expiresAt)) return false;
	return album.showOnHome || getSettings().featuredAlbumId === album.id;
}

/** The albums search engines may index (`isIndexable`), for the sitemap. */
export function listIndexableAlbums(): {
	slug: string;
	updatedAt: string;
	coverKey: string | null;
}[] {
	const featuredId = getSettings().featuredAlbumId ?? -1;
	const rows = all<{
		slug: string;
		updated_at: string;
		expires_at: string | null;
		cover_key: string | null;
	}>(
		`SELECT a.slug, a.updated_at, a.expires_at, c.key AS cover_key FROM albums a
		 LEFT JOIN photos c ON c.id = ${EFFECTIVE_COVER}
		 WHERE a.is_public = 1 AND a.password_hash IS NULL AND (a.show_on_home = 1 OR a.id = ?)
		 ORDER BY a.updated_at DESC`,
		featuredId
	);
	return rows
		.filter((row) => !isExpired(row.expires_at))
		.map((row) => ({ slug: row.slug, updatedAt: row.updated_at, coverKey: row.cover_key }));
}

/** Albums that can be featured on the homepage (public ones), for the settings picker. */
export function listFeaturableAlbums(): {
	id: number;
	title: string;
	expired: boolean;
	locked: boolean;
}[] {
	return all<{
		id: number;
		title: string;
		expires_at: string | null;
		password_hash: string | null;
	}>(
		'SELECT id, title, expires_at, password_hash FROM albums WHERE is_public = 1 ORDER BY created_at DESC'
	).map((row) => ({
		id: row.id,
		title: row.title,
		expired: isExpired(row.expires_at),
		locked: !!row.password_hash
	}));
}

interface AdminAlbumRow extends AlbumCardData {
	count: number;
	isPublic: boolean;
	showOnHome: boolean;
	isFeatured: boolean;
	expired: boolean;
	expiresAt: string | null;
	createdAt: string;
	views: number;
	photoDownloads: number;
	albumDownloads: number;
}

export function listAdminAlbums(): AdminAlbumRow[] {
	const featuredId = getSettings().featuredAlbumId;
	const rows = all<ListingRow>(`${LISTING_SQL} ORDER BY a.created_at DESC`);
	return rows.map((row) => ({
		...toCard(row),
		count: row.count,
		isPublic: !!row.is_public,
		showOnHome: !!row.show_on_home,
		isFeatured: row.id === featuredId,
		expired: isExpired(row.expires_at),
		expiresAt: row.expires_at,
		createdAt: row.created_at,
		views: row.views,
		photoDownloads: row.photo_downloads,
		albumDownloads: row.album_downloads
	}));
}

export function getStats() {
	const albums = get<{ n: number; views: number; pd: number; ad: number }>(
		`SELECT COUNT(*) AS n, COALESCE(SUM(views), 0) AS views, COALESCE(SUM(photo_downloads), 0) AS pd,
			COALESCE(SUM(album_downloads), 0) AS ad FROM albums`
	)!;
	const photos = get<{ n: number; bytes: number }>(
		'SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM photos'
	)!;
	return {
		albums: albums.n,
		photos: photos.n,
		bytes: photos.bytes,
		views: albums.views,
		photoDownloads: albums.pd,
		albumDownloads: albums.ad
	};
}

export function albumPhotoCount(albumId: number) {
	return get<{ n: number }>('SELECT COUNT(*) AS n FROM photos WHERE album_id = ?', albumId)!.n;
}

export function albumPhotoStats(albumId: number) {
	return get<{ count: number; bytes: number }>(
		'SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM photos WHERE album_id = ?',
		albumId
	)!;
}
