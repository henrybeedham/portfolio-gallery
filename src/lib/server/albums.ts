import { all, get, run, transaction } from './db.js';
import type { AlbumCardData, ImageRef, Layout, SortOrder } from '#lib/types.js';
import { isExpired } from '#lib/utils.js';

export interface Album {
	id: number;
	title: string;
	slug: string;
	description: string;
	albumDate: string | null;
	isPublic: boolean;
	showOnHome: boolean;
	showOnGalleries: boolean;
	isFeatured: boolean;
	passwordHash: string | null;
	expiresAt: string | null;
	accentColor: string;
	layout: Layout;
	sortOrder: SortOrder;
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
	show_on_galleries: number;
	is_featured: number;
	password_hash: string | null;
	expires_at: string | null;
	accent_color: string;
	layout: string;
	sort_order: string;
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
		showOnGalleries: !!row.show_on_galleries,
		isFeatured: !!row.is_featured,
		passwordHash: row.password_hash,
		expiresAt: row.expires_at,
		accentColor: row.accent_color,
		layout: row.layout === 'masonry' ? 'masonry' : 'grid',
		sortOrder: (['oldest', 'newest', 'random'].includes(row.sort_order)
			? row.sort_order
			: 'oldest') as SortOrder,
		coverPhotoId: row.cover_photo_id,
		backgroundPhotoId: row.background_photo_id,
		views: row.views,
		photoDownloads: row.photo_downloads,
		albumDownloads: row.album_downloads,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export const RESERVED_SLUGS = new Set([
	'admin',
	'api',
	'galleries',
	'media',
	'site',
	'healthz',
	'_app',
	'favicon.svg',
	'robots.txt'
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
	| 'showOnGalleries'
	| 'isFeatured'
	| 'expiresAt'
	| 'accentColor'
	| 'layout'
	| 'sortOrder'
> & { passwordHash: string | null };

export function createAlbum(input: AlbumInput): number {
	return transaction(() => {
		if (input.isFeatured) run('UPDATE albums SET is_featured = 0');
		const result = run(
			`INSERT INTO albums (title, slug, description, album_date, is_public, show_on_home, show_on_galleries,
				is_featured, password_hash, expires_at, accent_color, layout, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			input.title,
			input.slug,
			input.description,
			input.albumDate,
			input.isPublic,
			input.showOnHome,
			input.showOnGalleries,
			input.isFeatured,
			input.passwordHash,
			input.expiresAt,
			input.accentColor,
			input.layout,
			input.sortOrder
		);
		return result.lastInsertRowid;
	});
}

export function updateAlbum(id: number, input: AlbumInput) {
	transaction(() => {
		if (input.isFeatured) run('UPDATE albums SET is_featured = 0 WHERE id != ?', id);
		run(
			`UPDATE albums SET title = ?, slug = ?, description = ?, album_date = ?, is_public = ?, show_on_home = ?,
				show_on_galleries = ?, is_featured = ?, password_hash = ?, expires_at = ?, accent_color = ?, layout = ?,
				sort_order = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			 WHERE id = ?`,
			input.title,
			input.slug,
			input.description,
			input.albumDate,
			input.isPublic,
			input.showOnHome,
			input.showOnGalleries,
			input.isFeatured,
			input.passwordHash,
			input.expiresAt,
			input.accentColor,
			input.layout,
			input.sortOrder,
			id
		);
	});
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
	show_on_galleries: number;
	is_featured: number;
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
		a.show_on_galleries, a.is_featured, a.created_at, a.views, a.photo_downloads, a.album_downloads,
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

export function listPublicAlbums(where: 'home' | 'galleries'): AlbumCardData[] {
	const column = where === 'home' ? 'show_on_home' : 'show_on_galleries';
	const rows = all<ListingRow>(`${LISTING_SQL} WHERE a.is_public = 1 AND a.${column} = 1`);
	return rows
		.filter((row) => !isExpired(row.expires_at))
		.filter((row) => (where === 'home' ? !row.is_featured : true))
		.sort(sortByDate)
		.map(toCard);
}

export function getFeaturedAlbum(): Album | undefined {
	const row = get<AlbumRow>('SELECT * FROM albums WHERE is_featured = 1 AND is_public = 1 LIMIT 1');
	if (!row || isExpired(row.expires_at)) return undefined;
	return mapAlbum(row);
}

export interface AdminAlbumRow extends AlbumCardData {
	isPublic: boolean;
	showOnHome: boolean;
	showOnGalleries: boolean;
	isFeatured: boolean;
	expired: boolean;
	expiresAt: string | null;
	createdAt: string;
	views: number;
	photoDownloads: number;
	albumDownloads: number;
}

export function listAdminAlbums(): AdminAlbumRow[] {
	const rows = all<ListingRow>(`${LISTING_SQL} ORDER BY a.created_at DESC`);
	return rows.map((row) => ({
		...toCard(row),
		isPublic: !!row.is_public,
		showOnHome: !!row.show_on_home,
		showOnGalleries: !!row.show_on_galleries,
		isFeatured: !!row.is_featured,
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

export function albumPhotoStats(albumId: number) {
	return get<{ count: number; bytes: number }>(
		'SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM photos WHERE album_id = ?',
		albumId
	)!;
}
