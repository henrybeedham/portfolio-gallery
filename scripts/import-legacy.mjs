#!/usr/bin/env node
/**
 * Imports albums, photos, tags, settings, the hero image and analytics from the previous
 * version of the gallery (github.com/henrybeedham/client-gallery) into this one.
 *
 * Run it with `scripts/import-legacy.sh`, which starts this script inside a one-off container
 * built from the new gallery image, with the old container's data mounted READ-ONLY and the
 * new gallery's data directory mounted read-write. The old gallery is never modified: its
 * database is snapshotted to a temporary copy before it is read.
 *
 * Re-running is safe: everything imported is recorded in a `legacy_import_map` table, so
 * albums and photos that were already imported are skipped (an interrupted run resumes).
 *
 * Flags: --dry-run (show the plan only), --yes (accept the default answer to every question)
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import exifr from 'exifr';

sharp.cache(false);

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has('--dry-run');
const ASSUME_DEFAULTS = argv.has('--yes') || argv.has('-y');

const LEGACY_DB = process.env.LEGACY_DB || '/app/data/gallery.db';
const LEGACY_UPLOADS = process.env.LEGACY_UPLOADS || '/app/uploads';
const LEGACY_HERO_DIR = process.env.LEGACY_HERO_DIR || path.join(LEGACY_UPLOADS, 'hero');
const LEGACY_TZ = process.env.LEGACY_TZ || 'UTC';
const DATA_DIR = path.resolve(process.env.DATA_DIR || '/data');

const NEW_PATHS = {
	db: path.join(DATA_DIR, 'gallery.db'),
	originals: path.join(DATA_DIR, 'photos', 'originals'),
	thumbs: path.join(DATA_DIR, 'photos', 'thumbs'),
	medium: path.join(DATA_DIR, 'photos', 'medium'),
	site: path.join(DATA_DIR, 'site')
};

// Keep in sync with src/lib/server/albums.ts (plus "album", used for redirects from old links).
const RESERVED_SLUGS = new Set([
	'admin',
	'album',
	'api',
	'galleries',
	'media',
	'site',
	'healthz',
	'_app',
	'favicon.svg',
	'robots.txt'
]);
const CONCURRENCY = Math.max(1, Math.min(3, os.availableParallelism() - 1));

/* ------------------------------------------------------------------ output */

const tty = process.stdout.isTTY;
const c = (code) => (text) => (tty ? `\x1b[${code}m${text}\x1b[0m` : String(text));
const bold = c('1');
const dim = c('2');
const green = c('32');
const yellow = c('33');
const red = c('31');
const cyan = c('36');

const log = (...args) => console.log(...args);
const heading = (text) => log(`\n${bold(text)}\n${dim('─'.repeat(Math.min(72, text.length + 8)))}`);
const fmtBytes = (bytes) => {
	if (!bytes) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};
const n = (value) => Number(value).toLocaleString('en-GB');
const pad = (text, width) => {
	const s = String(text);
	return s.length > width ? s.slice(0, width - 1) + '…' : s.padEnd(width);
};

let statusLineActive = false;
function status(text) {
	if (!tty) return;
	process.stdout.write(`\r\x1b[2K${text}`);
	statusLineActive = true;
}
function endStatus() {
	if (statusLineActive) process.stdout.write('\r\x1b[2K');
	statusLineActive = false;
}

/* ---------------------------------------------------------------- prompts */

// Lines are queued as they arrive: readline drops lines that come in before a question is asked,
// which loses answers when input is piped or typed ahead.
let rl;
let inputClosed = false;
const pendingLines = [];
const waiters = [];

/** Before the import starts, Ctrl-C cancels without changing anything. */
let onInterrupt = () => {
	endStatus();
	log(yellow('\nCancelled — nothing was changed.'));
	process.exit(3);
};
process.on('SIGINT', () => onInterrupt());

function input() {
	if (!rl) {
		rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: !!process.stdin.isTTY
		});
		rl.on('line', (line) => (waiters.length ? waiters.shift()(line) : pendingLines.push(line)));
		rl.on('close', () => {
			inputClosed = true;
			while (waiters.length) waiters.shift()(null);
		});
		// In a terminal, readline swallows Ctrl-C; forward it.
		rl.on('SIGINT', () => process.emit('SIGINT', 'SIGINT'));
	}
	return rl;
}

function nextLine() {
	if (pendingLines.length) return Promise.resolve(pendingLines.shift());
	if (inputClosed) return Promise.resolve(null);
	return new Promise((resolve) => waiters.push(resolve));
}

function closeInput() {
	if (rl && !inputClosed) rl.close();
}

async function ask(question, fallback = '') {
	const prompt = `${question} ${fallback ? dim(`[${fallback}] `) : ''}`;
	if (ASSUME_DEFAULTS) {
		log(`${prompt}${dim('(default)')}`);
		return fallback;
	}
	const reader = input();
	if (inputClosed) {
		// stdin already ended (piped answers); keep using the lines that were queued.
		process.stdout.write(prompt);
	} else {
		reader.setPrompt(prompt);
		reader.prompt();
	}
	const line = await nextLine();
	if (line === null) {
		throw new Error(
			'Input ended before all questions were answered. Run the script in an interactive terminal, or pass --yes to accept the defaults.'
		);
	}
	if (!process.stdin.isTTY) process.stdout.write(`${line}\n`);
	return line.trim() || fallback;
}

async function confirm(question, defaultYes = true) {
	for (;;) {
		const answer = (
			await ask(`${question} ${dim(defaultYes ? '(Y/n)' : '(y/N)')}`, defaultYes ? 'y' : 'n')
		).toLowerCase();
		if (['y', 'yes'].includes(answer)) return true;
		if (['n', 'no'].includes(answer)) return false;
		log(yellow('  Please answer y or n.'));
	}
}

async function choose(question, options, fallback) {
	const keys = options.map((o) => o.key);
	for (;;) {
		log(question);
		for (const option of options) log(`  ${bold(option.key)}) ${option.label}`);
		const answer = (await ask('Choose', fallback)).toLowerCase();
		if (keys.includes(answer)) return answer;
		log(yellow(`  Please enter one of: ${keys.join(', ')}`));
	}
}

/* ------------------------------------------------------------ conversions */

function slugify(input) {
	return String(input ?? '')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

/** SQLite CURRENT_TIMESTAMP ("YYYY-MM-DD HH:MM:SS", UTC) → ISO string as used by the new app. */
function sqliteTimeToIso(value) {
	if (!value) return new Date().toISOString();
	const text = String(value).trim();
	const match =
		/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(text);
	if (match && !match[4]) {
		const time = match[2].length === 5 ? `${match[2]}:00` : match[2];
		const date = new Date(`${match[1]}T${time}Z`);
		if (!isNaN(date.getTime())) return date.toISOString();
	}
	const date = new Date(text);
	return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffset(instant, timeZone) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(new Date(instant));
	const get = (type) => Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour'),
		get('minute'),
		get('second')
	);
	return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The old app stored expiry dates as raw `datetime-local` values (no timezone) and compared
 * them in the server's local timezone, so they are converted using that timezone.
 */
function expiryToIso(value) {
	if (!value) return null;
	const text = String(value).trim();
	if (!text) return null;
	const naive = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
	if (naive) {
		const [, y, mo, d, h = '0', mi = '0', s = '0'] = naive;
		const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
		let zone = 'UTC';
		try {
			zoneOffset(wall, LEGACY_TZ);
			zone = LEGACY_TZ;
		} catch {
			zone = 'UTC';
		}
		let instant = wall - zoneOffset(wall, zone);
		instant = wall - zoneOffset(instant, zone);
		return new Date(instant).toISOString();
	}
	const date = new Date(text);
	return isNaN(date.getTime()) ? null : date.toISOString();
}

function takenAt(value) {
	if (!value) return null;
	const match = /^(\d{4})[-:](\d{2})[-:](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(
		String(value)
	);
	if (!match || match[1] === '0000') return null;
	const [, y, m, d, hh, mm, ss = '00'] = match;
	return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

function hashPassword(password) {
	// Same format as src/lib/server/auth.ts
	const salt = crypto.randomBytes(16);
	const hash = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
	return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

/* ------------------------------------------------------------ image files */

const FORMAT_TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const TYPE_EXT = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

const newKey = () => crypto.randomBytes(12).toString('base64url');
const shard = (key) => key.slice(0, 2).toLowerCase();
const originalPath = (key, ext) => path.join(NEW_PATHS.originals, shard(key), `${key}.${ext}`);
const variantPath = (key, variant) =>
	path.join(variant === 'thumb' ? NEW_PATHS.thumbs : NEW_PATHS.medium, shard(key), `${key}.webp`);

async function inspectImage(file) {
	const meta = await sharp(file, { failOn: 'none' }).metadata();
	const mime = meta.format ? FORMAT_TYPES[meta.format] : undefined;
	if (!mime) throw new Error(`unsupported image format (${meta.format ?? 'unknown'})`);
	const swap = (meta.orientation ?? 1) >= 5;
	return {
		mime,
		ext: TYPE_EXT[mime],
		width: (swap ? meta.height : meta.width) ?? 0,
		height: (swap ? meta.width : meta.height) ?? 0
	};
}

// Mirrors generateVariants() in src/lib/server/images.ts
async function generateVariants(source, key, width, height) {
	const thumbFile = variantPath(key, 'thumb');
	const mediumFile = variantPath(key, 'medium');
	await fsp.mkdir(path.dirname(thumbFile), { recursive: true });
	await fsp.mkdir(path.dirname(mediumFile), { recursive: true });
	const scale = Math.min(1, 720 / Math.min(width, height), 1600 / Math.max(width, height));
	const thumb = {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
	const base = sharp(source, { failOn: 'none' }).autoOrient();
	await Promise.all([
		base
			.clone()
			.resize(thumb.width, thumb.height, { fit: 'fill' })
			.webp({ quality: 80, effort: 4 })
			.toFile(thumbFile),
		base
			.clone()
			.resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 84, effort: 4 })
			.toFile(mediumFile)
	]);
}

/** Reads EXIF from a buffer (passing a path to exifr leaks a file handle). */
async function readExif(file) {
	const handle = await fsp.open(file, 'r');
	let buffer;
	try {
		const { size } = await handle.stat();
		const head = Buffer.alloc(Math.min(size, 2));
		await handle.read(head, 0, head.length, 0);
		const length =
			head[0] === 0xff && head[1] === 0xd8
				? Math.min(size, 512 * 1024)
				: Math.min(size, 64 * 1024 * 1024);
		buffer = Buffer.alloc(length);
		await handle.read(buffer, 0, length, 0);
	} finally {
		await handle.close();
	}
	try {
		return (
			(await exifr.parse(buffer, {
				tiff: true,
				exif: true,
				gps: false,
				iptc: false,
				xmp: false,
				icc: false,
				jfif: false,
				ihdr: false,
				reviveValues: false,
				translateValues: false
			})) ?? {}
		);
	} catch {
		return {};
	}
}

const text = (value) => {
	if (typeof value !== 'string') return null;
	const trimmed = value.replace(/\0/g, '').trim();
	return trimmed || null;
};

/* ---------------------------------------------------------------- old data */

async function statOrNull(file) {
	try {
		return await fsp.stat(file);
	} catch {
		return null;
	}
}

/**
 * Copies the old database (and its WAL) to a private temporary folder, retrying until the copy
 * is consistent, so the live database is only ever read.
 */
async function snapshotLegacyDatabase() {
	const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'legacy-gallery-'));
	const target = path.join(dir, 'legacy.db');
	const sources = [LEGACY_DB, `${LEGACY_DB}-wal`];
	const signature = async () =>
		(await Promise.all(sources.map(statOrNull)))
			.map((s) => (s ? `${s.size}:${s.mtimeMs}` : '-'))
			.join('|');

	for (let attempt = 1; attempt <= 8; attempt++) {
		const before = await signature();
		await fsp.copyFile(LEGACY_DB, target);
		if (await statOrNull(`${LEGACY_DB}-wal`))
			await fsp.copyFile(`${LEGACY_DB}-wal`, `${target}-wal`);
		else await fsp.rm(`${target}-wal`, { force: true });
		await fsp.rm(`${target}-shm`, { force: true });
		if ((await signature()) === before) {
			const db = new DatabaseSync(target);
			const check = db.prepare('PRAGMA quick_check').get();
			if (Object.values(check)[0] === 'ok') return { db, dir };
			db.close();
		}
		await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
	}
	throw new Error(
		'The old database kept changing while it was being copied. Try again in a moment, or stop the old container briefly while the snapshot is taken.'
	);
}

function tableExists(db, name) {
	return !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name);
}

function loadLegacy(db) {
	if (!tableExists(db, 'albums') || !tableExists(db, 'photos')) {
		throw new Error(`${LEGACY_DB} does not look like a database from the old gallery.`);
	}
	const albums = db.prepare('SELECT * FROM albums ORDER BY id').all();
	const photos = db.prepare('SELECT * FROM photos ORDER BY album_id, id').all();
	const tags = tableExists(db, 'photo_tags')
		? db.prepare('SELECT * FROM photo_tags ORDER BY id').all()
		: [];
	const tagLinks = tableExists(db, 'photo_tag_relations')
		? db.prepare('SELECT photo_id, tag_id FROM photo_tag_relations').all()
		: [];
	const settings = tableExists(db, 'settings')
		? Object.fromEntries(
				db
					.prepare('SELECT key, value FROM settings')
					.all()
					.map((r) => [r.key, r.value])
			)
		: {};

	const albumEvents = new Map();
	const photoDownloads = new Map();
	let eventCount = 0;
	if (tableExists(db, 'analytics')) {
		for (const row of db
			.prepare(
				'SELECT album_id, event_type, COUNT(*) AS n FROM analytics GROUP BY album_id, event_type'
			)
			.all()) {
			const entry = albumEvents.get(row.album_id) ?? { views: 0, downloads: 0, albumDownloads: 0 };
			if (row.event_type === 'page_view') entry.views += row.n;
			else if (row.event_type === 'download') entry.downloads += row.n;
			else if (row.event_type === 'album_download') entry.albumDownloads += row.n;
			albumEvents.set(row.album_id, entry);
			eventCount += row.n;
		}
		for (const row of db
			.prepare(
				`SELECT photo_id, COUNT(*) AS n FROM analytics WHERE event_type = 'download' AND photo_id IS NOT NULL GROUP BY photo_id`
			)
			.all()) {
			photoDownloads.set(row.photo_id, row.n);
		}
	}

	const photosByAlbum = new Map();
	for (const photo of photos) {
		const list = photosByAlbum.get(photo.album_id) ?? [];
		list.push(photo);
		photosByAlbum.set(photo.album_id, list);
	}

	return {
		albums,
		photos,
		photosByAlbum,
		tags,
		tagLinks,
		settings,
		albumEvents,
		photoDownloads,
		eventCount
	};
}

/** Finds the file for an old photo: the original, falling back to the medium-size copy. */
async function legacyPhotoFile(album, photo) {
	const original = path.join(LEGACY_UPLOADS, album.slug, 'original', photo.filename);
	const originalStat = await statOrNull(original);
	if (originalStat?.isFile())
		return { file: original, size: originalStat.size, source: 'original' };
	const medium = path.join(LEGACY_UPLOADS, album.slug, 'medium', photo.filename);
	const mediumStat = await statOrNull(medium);
	if (mediumStat?.isFile()) return { file: medium, size: mediumStat.size, source: 'medium' };
	return null;
}

/* ---------------------------------------------------------------- new data */

function openNewDatabase() {
	if (!fs.existsSync(NEW_PATHS.db)) {
		throw new Error(
			`No database found at ${NEW_PATHS.db}. Start the new gallery once so it can create it, then run the import again.`
		);
	}
	const db = new DatabaseSync(NEW_PATHS.db);
	db.exec('PRAGMA busy_timeout = 15000; PRAGMA foreign_keys = ON;');
	const version = db.prepare('PRAGMA user_version').get().user_version;
	if (version < 1 || !tableExists(db, 'albums') || !tableExists(db, 'photos')) {
		throw new Error(
			`${NEW_PATHS.db} has not been initialised by the new gallery yet. Start it once, then try again.`
		);
	}
	return db;
}

function transaction(db, fn) {
	db.exec('BEGIN IMMEDIATE');
	try {
		const result = fn();
		db.exec('COMMIT');
		return result;
	} catch (error) {
		db.exec('ROLLBACK');
		throw error;
	}
}

/** Previously imported albums/photos that still exist in the new gallery. */
function loadImportMap(db) {
	const albums = new Map();
	const photos = new Map();
	if (!tableExists(db, 'legacy_import_map')) return { albums, photos };
	const liveAlbums = new Set(
		db
			.prepare('SELECT id FROM albums')
			.all()
			.map((r) => r.id)
	);
	const livePhotos = new Set(
		db
			.prepare('SELECT id FROM photos')
			.all()
			.map((r) => r.id)
	);
	for (const row of db.prepare('SELECT kind, old_id, new_id FROM legacy_import_map').all()) {
		if (row.kind === 'album' && liveAlbums.has(row.new_id)) albums.set(row.old_id, row.new_id);
		if (row.kind === 'photo' && livePhotos.has(row.new_id)) photos.set(row.old_id, row.new_id);
	}
	return { albums, photos };
}

function ensureImportMapTable(db) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS legacy_import_map (
			kind TEXT NOT NULL,
			old_id INTEGER NOT NULL,
			new_id INTEGER NOT NULL,
			old_slug TEXT,
			imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			PRIMARY KEY (kind, old_id)
		);
		CREATE INDEX IF NOT EXISTS legacy_import_map_slug ON legacy_import_map(old_slug);
	`);
}

function readNewSettings(db) {
	const row = db.prepare(`SELECT value FROM settings WHERE key = 'site'`).get();
	if (!row) return { stored: null, values: {} };
	try {
		return { stored: row.value, values: JSON.parse(row.value) };
	} catch {
		return { stored: row.value, values: {} };
	}
}

/** Maps the old key/value settings onto the new settings object. */
function convertSettings(old) {
	const out = {};
	const str = (key, target = key) => {
		if (old[key] !== undefined) out[target] = String(old[key]);
	};
	const bool = (key, target = key) => {
		if (old[key] !== undefined) out[target] = old[key] === 'true';
	};
	str('siteTitle');
	str('copyrightText', 'copyright');
	str('heroTitle');
	str('heroDescription');
	str('aboutTitle');
	str('aboutText');
	str('contactEmail');
	str('contactPhone');
	str('discordWebhook');
	str('defaultDescription');
	bool('showContactOnHome');
	bool('defaultIsPublic', 'defaultPublic');
	bool('defaultShowOnHome');
	if (old.theme !== undefined) out.theme = old.theme === 'dark' ? 'dark' : 'light';
	if (old.defaultLayoutStyle !== undefined)
		out.defaultLayout = old.defaultLayoutStyle === 'masonry' ? 'masonry' : 'grid';
	if (old.defaultSortOrder !== undefined)
		out.defaultSort = ['newest', 'random'].includes(old.defaultSortOrder)
			? old.defaultSortOrder
			: 'oldest';
	if (out.siteTitle !== undefined && !out.siteTitle.trim()) delete out.siteTitle;
	return out;
}

/* ------------------------------------------------------------------- main */

async function main() {
	if (!process.env.IMPORT_WRAPPED) {
		log(bold('\nImport from the previous gallery'));
		log(dim('The old gallery is only read from — nothing in it is changed.\n'));
	}

	if (!fs.existsSync(LEGACY_DB)) {
		throw new Error(
			`Could not find the old database at ${LEGACY_DB}. Is the old container's data mounted? (Use scripts/import-legacy.sh.)`
		);
	}
	if (!fs.existsSync(LEGACY_UPLOADS)) {
		throw new Error(`Could not find the old photo folder at ${LEGACY_UPLOADS}.`);
	}

	status('Taking a snapshot of the old database…');
	const { db: legacyDb, dir: snapshotDir } = await snapshotLegacyDatabase();
	endStatus();
	const cleanup = async () => {
		try {
			legacyDb.close();
		} catch {
			/* already closed */
		}
		await fsp.rm(snapshotDir, { recursive: true, force: true });
	};

	try {
		const legacy = loadLegacy(legacyDb);
		const db = openNewDatabase();
		const imported = loadImportMap(db);

		/* ---------------------------------------------------------- analyse */

		status('Checking photo files…');
		const albumById = new Map(legacy.albums.map((a) => [a.id, a]));
		const fileInfo = new Map();
		let checked = 0;
		await Promise.all(
			legacy.photos.map(async (photo) => {
				const album = albumById.get(photo.album_id);
				fileInfo.set(photo.id, album ? await legacyPhotoFile(album, photo) : null);
				if (++checked % 200 === 0)
					status(`Checking photo files… ${n(checked)}/${n(legacy.photos.length)}`);
			})
		);
		endStatus();

		const newSlugs = new Set(
			db
				.prepare('SELECT slug FROM albums')
				.all()
				.map((r) => r.slug)
		);
		const newCounts = db
			.prepare(
				'SELECT (SELECT COUNT(*) FROM albums) AS albums, (SELECT COUNT(*) FROM photos) AS photos'
			)
			.get();
		const hasFeatured = !!db.prepare('SELECT 1 FROM albums WHERE is_featured = 1').get();
		const newSettings = readNewSettings(db);

		const currentSlug = new Map(
			db
				.prepare('SELECT id, slug FROM albums')
				.all()
				.map((r) => [r.id, r.slug])
		);
		const plan = legacy.albums.map((album) => {
			const photos = legacy.photosByAlbum.get(album.id) ?? [];
			const pending = photos.filter((p) => !imported.photos.has(p.id));
			const available = pending.filter((p) => fileInfo.get(p.id));
			const fromMedium = available.filter((p) => fileInfo.get(p.id).source === 'medium').length;
			const bytes = available.reduce((sum, p) => sum + fileInfo.get(p.id).size, 0);
			const mappedId = imported.albums.get(album.id) ?? null;
			const wantedSlug = slugify(album.slug) || slugify(album.title) || `album-${album.id}`;
			let conflict = null;
			if (!mappedId) {
				if (RESERVED_SLUGS.has(wantedSlug)) conflict = 'reserved';
				else if (newSlugs.has(wantedSlug)) conflict = 'exists';
			}
			return {
				album,
				photos,
				pending,
				available,
				missing: pending.length - available.length,
				fromMedium,
				bytes,
				mappedId,
				wantedSlug,
				conflict,
				slug: mappedId ? currentSlug.get(mappedId) : wantedSlug,
				// Albums that were fully imported before have nothing left to do.
				include: !(mappedId && !pending.length)
			};
		});

		const heroFile = legacy.settings.heroImage
			? path.join(LEGACY_HERO_DIR, path.basename(legacy.settings.heroImage))
			: null;
		const heroExists = !!(heroFile && (await statOrNull(heroFile))?.isFile());
		const totalPhotos = legacy.photos.length;
		const totalBytes = plan.reduce((sum, entry) => sum + entry.bytes, 0);

		heading('Old gallery');
		log(`  Database     ${LEGACY_DB}`);
		log(`  Photos dir   ${LEGACY_UPLOADS}`);
		log(
			`  Contents     ${n(legacy.albums.length)} albums · ${n(totalPhotos)} photos · ${n(legacy.tags.length)} tags · ${n(legacy.eventCount)} analytics events`
		);
		log(`  Hero image   ${heroExists ? path.basename(heroFile) : dim('none')}`);
		log(`  Site title   ${legacy.settings.siteTitle ?? dim('(default)')}`);

		heading('New gallery');
		log(`  Data dir     ${DATA_DIR}`);
		log(`  Contents     ${n(newCounts.albums)} albums · ${n(newCounts.photos)} photos`);
		if (imported.albums.size) {
			log(
				`  ${cyan(`${n(imported.albums.size)} albums were imported by an earlier run — only missing photos will be added.`)}`
			);
		}

		heading('Albums');
		log(dim(`  ${pad('#', 4)}${pad('Title', 34)}${pad('Photos', 9)}${pad('New URL', 30)}Notes`));
		plan.forEach((entry, i) => {
			const notes = [];
			if (entry.mappedId)
				notes.push(
					entry.pending.length ? `resume: ${entry.pending.length} to add` : 'already imported'
				);
			if (entry.conflict === 'exists') notes.push(yellow('slug already used'));
			if (entry.conflict === 'reserved') notes.push(yellow('slug is reserved'));
			if (entry.wantedSlug !== entry.album.slug && !entry.mappedId)
				notes.push(`was /album/${entry.album.slug}`);
			if (entry.album.password) notes.push('password');
			if (entry.missing) notes.push(red(`${entry.missing} missing files`));
			if (entry.fromMedium)
				notes.push(yellow(`${entry.fromMedium} original(s) missing, using medium copy`));
			log(
				`  ${pad(i + 1, 4)}${pad(entry.album.title, 34)}${pad(n(entry.photos.length), 9)}${pad(`/${entry.slug}`, 30)}${notes.join(', ')}`
			);
		});
		if (!plan.length) log(dim('  (no albums)'));

		/* --------------------------------------------------------- questions */

		heading('Options');

		const selectable = plan.filter((entry) => !(entry.mappedId && !entry.pending.length));
		if (
			selectable.length > 1 &&
			!(await confirm(`Import all ${selectable.length} albums?`, true))
		) {
			const answer = await ask('Album numbers to import (e.g. 1,3,5-7):', '');
			const chosen = new Set();
			for (const part of answer.split(',')) {
				const range = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
				if (!range) continue;
				const from = Number(range[1]);
				const to = Number(range[2] ?? range[1]);
				for (let i = Math.min(from, to); i <= Math.max(from, to); i++) chosen.add(i);
			}
			plan.forEach((entry, i) => (entry.include = chosen.has(i + 1) && selectable.includes(entry)));
		}

		const conflicts = plan.filter((entry) => entry.include && entry.conflict);
		if (conflicts.length) {
			log(
				`\n${yellow(`${conflicts.length} album(s) can't use their old URL in the new gallery:`)}`
			);
			for (const entry of conflicts) {
				log(
					`  • ${entry.album.title} (/${entry.wantedSlug}) — ${entry.conflict === 'reserved' ? 'reserved by the new app' : 'an album with this URL already exists'}`
				);
			}
			const choice = await choose(
				'What should happen to them?',
				[
					{ key: 'r', label: 'Import them with a new URL (e.g. /name-2)' },
					{ key: 's', label: 'Skip them' }
				],
				'r'
			);
			const taken = new Set([
				...newSlugs,
				...plan.filter((e) => e.include && !e.conflict).map((e) => e.slug)
			]);
			for (const entry of conflicts) {
				if (choice === 's') {
					entry.include = false;
					continue;
				}
				let i = 2;
				while (
					taken.has(`${entry.wantedSlug}-${i}`) ||
					RESERVED_SLUGS.has(`${entry.wantedSlug}-${i}`)
				)
					i++;
				entry.slug = `${entry.wantedSlug}-${i}`;
				taken.add(entry.slug);
				log(dim(`  ${entry.album.title} → /${entry.slug}`));
			}
		}

		const included = plan.filter((entry) => entry.include);
		const newAlbums = included.filter((entry) => !entry.mappedId);

		let importSettings = false;
		if (Object.keys(legacy.settings).some((key) => key !== 'heroImage')) {
			const customised = newSettings.stored !== null;
			importSettings = await confirm(
				customised
					? 'Import site settings (title, homepage text, contact details, theme, Discord webhook, album defaults)? This replaces the settings you have already changed in the new gallery.'
					: 'Import site settings (title, homepage text, contact details, theme, Discord webhook, album defaults)?',
				!customised
			);
		}

		let importHero = false;
		if (heroExists) {
			const newHasHero = !!newSettings.values.heroImage;
			importHero = await confirm(
				newHasHero
					? 'Import the old homepage hero image? This replaces the hero image already set in the new gallery.'
					: 'Import the homepage hero image?',
				!newHasHero
			);
		}

		let importAnalytics = false;
		if (legacy.eventCount && newAlbums.length) {
			importAnalytics = await confirm('Import page view and download counts?', true);
		}

		const photosToImport = included.reduce((sum, entry) => sum + entry.available.length, 0);
		const bytesToImport = included.reduce((sum, entry) => sum + entry.bytes, 0);
		let makeThumbnails = true;
		if (photosToImport) {
			makeThumbnails = await confirm(
				`Generate thumbnails now? (recommended — otherwise they are created the first time each photo is viewed)`,
				true
			);
		}

		// Featured album: the new app allows one; keep the old one only if none is set yet.
		const oldFeatured = newAlbums.filter((entry) => Number(entry.album.featured_on_home) === 1);
		const featured = hasFeatured
			? null
			: (oldFeatured.sort((a, b) =>
					String(b.album.created_at).localeCompare(String(a.album.created_at))
				)[0] ?? null);

		/* ----------------------------------------------------------- summary */

		heading('Summary');
		log(
			`  Albums       ${n(newAlbums.length)} new${included.length - newAlbums.length ? `, ${n(included.length - newAlbums.length)} resumed` : ''}`
		);
		log(`  Photos       ${n(photosToImport)} (${fmtBytes(bytesToImport)} of originals)`);
		log(
			`  Settings     ${importSettings ? 'yes' : 'no'}   Hero image: ${importHero ? 'yes' : 'no'}   Analytics: ${importAnalytics ? 'yes' : 'no'}`
		);
		if (photosToImport) log(`  Thumbnails   ${makeThumbnails ? 'generate now' : 'on first view'}`);
		if (oldFeatured.length) {
			log(
				`  Featured     ${featured ? `“${featured.album.title}”` : 'unchanged (the new gallery already has a featured album)'}${oldFeatured.length > 1 && featured ? dim(` — the new app features one album; ${oldFeatured.length - 1} other(s) won't be`) : ''}`
			);
		}
		const missingTotal = included.reduce((sum, entry) => sum + entry.missing, 0);
		if (missingTotal)
			log(
				`  ${red(`${n(missingTotal)} photo(s) have no file in the old gallery and will be skipped.`)}`
			);
		log(dim(`  Expiry dates are read in the old server's timezone (${LEGACY_TZ}).`));

		const space = await fsp.statfs(DATA_DIR).catch(() => null);
		const needed = bytesToImport * (makeThumbnails ? 1.25 : 1.02);
		if (space && space.bavail * space.bsize < needed) {
			log(
				red(
					`\n  Not enough disk space: about ${fmtBytes(needed)} is needed but only ${fmtBytes(space.bavail * space.bsize)} is free.`
				)
			);
			return 1;
		}

		if (!included.length && !importSettings && !importHero) {
			log('\nNothing to import.');
			return 3;
		}

		if (DRY_RUN) {
			log(`\n${cyan('Dry run — nothing was changed.')}`);
			return 3;
		}

		if (!(await confirm('\nStart the import?', true))) {
			log('Cancelled — nothing was changed.');
			return 3;
		}

		/* ------------------------------------------------------------ import */

		// No more questions: release stdin so Ctrl-C reaches the process directly.
		closeInput();
		ensureImportMapTable(db);
		const failures = [];
		let aborted = false;
		const inFlight = new Set();
		onInterrupt = () => {
			if (aborted) process.exit(130);
			aborted = true;
			endStatus();
			log(
				yellow('\nStopping after the photos in progress… (press Ctrl-C again to quit immediately)')
			);
		};

		// Settings and hero image first, so the site looks right even if the photo import is interrupted.
		if (importSettings || importHero) {
			const patch = importSettings ? convertSettings(legacy.settings) : {};
			if (importHero) {
				status('Importing hero image…');
				try {
					await fsp.mkdir(NEW_PATHS.site, { recursive: true });
					const base = sharp(heroFile, { failOn: 'none' }).autoOrient();
					await Promise.all([
						base
							.clone()
							.resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
							.webp({ quality: 84 })
							.toFile(path.join(NEW_PATHS.site, 'hero-large.webp')),
						base
							.clone()
							.resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
							.webp({ quality: 82 })
							.toFile(path.join(NEW_PATHS.site, 'hero-small.webp'))
					]);
					patch.heroImage = Date.now().toString(36);
				} catch (error) {
					failures.push(`Hero image: ${error.message}`);
				}
				endStatus();
			}
			const merged = { ...readNewSettings(db).values, ...patch };
			db.prepare(
				`INSERT INTO settings (key, value) VALUES ('site', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
			).run(JSON.stringify(merged));
			log(
				`${green('✓')} ${[importSettings && 'Settings', importHero && patch.heroImage && 'hero image'].filter(Boolean).join(' and ')} imported`
			);
		}

		const insertAlbum = db.prepare(`
			INSERT INTO albums (title, slug, description, album_date, is_public, show_on_home, show_on_galleries, is_featured,
				password_hash, expires_at, layout, sort_order, views, photo_downloads, album_downloads,
				created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
		const insertPhoto = db.prepare(`
			INSERT INTO photos (album_id, key, ext, original_name, mime, size, width, height, taken_at, downloads, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
		const insertMap = db.prepare(
			`INSERT OR REPLACE INTO legacy_import_map (kind, old_id, new_id, old_slug) VALUES (?, ?, ?, ?)`
		);

		let albumIndex = 0;
		let totalDone = 0;
		let totalFailed = 0;
		const started = Date.now();

		for (const entry of included) {
			if (aborted) break;
			albumIndex++;
			const { album } = entry;
			const label = `[${albumIndex}/${included.length}] ${album.title}`;

			let albumId = entry.mappedId;
			let created = false;
			if (!albumId) {
				try {
					const events = importAnalytics ? (legacy.albumEvents.get(album.id) ?? null) : null;
					albumId = transaction(db, () => {
						const result = insertAlbum.run(
							String(album.title || 'Untitled').slice(0, 200),
							entry.slug,
							album.description ?? '',
							/^\d{4}-\d{2}-\d{2}$/.test(String(album.album_date ?? '')) ? album.album_date : null,
							Number(album.is_public ?? 1) ? 1 : 0,
							Number(album.show_on_home ?? 1) ? 1 : 0,
							Number(album.show_on_galleries ?? 1) ? 1 : 0,
							featured === entry ? 1 : 0,
							album.password ? hashPassword(String(album.password)) : null,
							expiryToIso(album.expires_at),
							album.layout_style === 'masonry' ? 'masonry' : 'grid',
							['newest', 'random'].includes(album.sort_order) ? album.sort_order : 'oldest',
							events?.views ?? 0,
							events?.downloads ?? 0,
							events?.albumDownloads ?? 0,
							sqliteTimeToIso(album.created_at),
							sqliteTimeToIso(album.updated_at ?? album.created_at)
						);
						const id = Number(result.lastInsertRowid);
						insertMap.run('album', album.id, id, album.slug);
						return id;
					});
					created = true;
				} catch (error) {
					failures.push(`Album “${album.title}”: ${error.message}`);
					log(`${red('✗')} ${label} — could not create the album: ${error.message}`);
					continue;
				}
			}

			// Photos
			const queue = entry.available.slice();
			let done = 0;
			let failed = 0;
			const total = queue.length;
			const report = () =>
				status(
					`${label} — ${n(done)}/${n(total)} photos${failed ? red(` (${failed} failed)`) : ''}`
				);
			report();

			const worker = async () => {
				for (let photo = queue.shift(); photo && !aborted; photo = queue.shift()) {
					const info = fileInfo.get(photo.id);
					const key = newKey();
					let destination = null;
					try {
						const image = await inspectImage(info.file);
						destination = originalPath(key, image.ext);
						inFlight.add(destination);
						await fsp.mkdir(path.dirname(destination), { recursive: true });
						await fsp.copyFile(info.file, `${destination}.part`);
						await fsp.rename(`${destination}.part`, destination);
						if (makeThumbnails) await generateVariants(destination, key, image.width, image.height);
						const exif = await readExif(destination);
						const size = (await fsp.stat(destination)).size;
						transaction(db, () => {
							const result = insertPhoto.run(
								albumId,
								key,
								image.ext,
								String(photo.original_filename || photo.filename),
								image.mime,
								size,
								image.width || Number(photo.width) || 0,
								image.height || Number(photo.height) || 0,
								takenAt(photo.date_taken) ??
									takenAt(text(exif.DateTimeOriginal) ?? text(exif.CreateDate)),
								importAnalytics ? (legacy.photoDownloads.get(photo.id) ?? 0) : 0,
								sqliteTimeToIso(photo.created_at)
							);
							insertMap.run('photo', photo.id, Number(result.lastInsertRowid), null);
							imported.photos.set(photo.id, Number(result.lastInsertRowid));
						});
						inFlight.delete(destination);
						done++;
						totalDone++;
					} catch (error) {
						failed++;
						totalFailed++;
						failures.push(
							`${album.title} / ${photo.original_filename || photo.filename}: ${error.message}`
						);
						if (destination) {
							await Promise.all(
								[
									destination,
									`${destination}.part`,
									variantPath(key, 'thumb'),
									variantPath(key, 'medium')
								].map((f) => fsp.rm(f, { force: true }))
							);
							inFlight.delete(destination);
						}
					}
					report();
				}
			};
			await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, total)) }, worker));
			endStatus();

			// Tags (idempotent), plus cover and background images.
			try {
				transaction(db, () => {
					const tagIds = new Map();
					const albumTags = legacy.tags.filter((tag) => tag.album_id === album.id);
					for (const tag of albumTags) {
						const name = String(tag.name ?? '')
							.trim()
							.slice(0, 60);
						if (!name) continue;
						db.prepare('INSERT OR IGNORE INTO tags (album_id, name) VALUES (?, ?)').run(
							albumId,
							name
						);
						const row = db
							.prepare('SELECT id FROM tags WHERE album_id = ? AND name = ?')
							.get(albumId, name);
						if (row) tagIds.set(tag.id, row.id);
					}
					for (const link of legacy.tagLinks) {
						const tagId = tagIds.get(link.tag_id);
						const photoId = imported.photos.get(link.photo_id);
						if (tagId && photoId) {
							db.prepare('INSERT OR IGNORE INTO photo_tags (photo_id, tag_id) VALUES (?, ?)').run(
								photoId,
								tagId
							);
						}
					}
					const current = db
						.prepare('SELECT cover_photo_id, background_photo_id FROM albums WHERE id = ?')
						.get(albumId);
					const cover = imported.photos.get(album.cover_photo_id);
					const background = imported.photos.get(album.background_photo_id);
					if (cover && !current.cover_photo_id)
						db.prepare('UPDATE albums SET cover_photo_id = ? WHERE id = ?').run(cover, albumId);
					if (background && !current.background_photo_id) {
						db.prepare('UPDATE albums SET background_photo_id = ? WHERE id = ?').run(
							background,
							albumId
						);
					}
				});
			} catch (error) {
				failures.push(`${album.title} (tags/cover): ${error.message}`);
			}

			const mark = failed ? yellow('!') : green('✓');
			log(
				`${mark} ${label} — ${created ? 'created' : 'resumed'}, ${n(done)} photo${done === 1 ? '' : 's'} imported${failed ? red(`, ${failed} failed`) : ''}`
			);
		}

		for (const file of inFlight) {
			await fsp.rm(`${file}.part`, { force: true });
		}

		/* ---------------------------------------------------------- report */

		const seconds = Math.round((Date.now() - started) / 1000);
		heading(aborted ? 'Stopped' : 'Done');
		log(
			`  ${n(totalDone)} photo(s) imported in ${seconds}s${totalFailed ? red(`, ${n(totalFailed)} failed`) : ''}.`
		);
		if (aborted)
			log(yellow('  Run the import again to continue — anything already imported is skipped.'));

		if (failures.length) {
			const logFile = path.join(
				DATA_DIR,
				`legacy-import-${new Date().toISOString().replace(/[:.]/g, '-')}.log`
			);
			await fsp.writeFile(logFile, failures.join('\n') + '\n').catch(() => {});
			log(red(`  ${failures.length} problem(s):`));
			for (const failure of failures.slice(0, 10)) log(red(`   • ${failure}`));
			if (failures.length > 10) log(red(`   … and ${failures.length - 10} more`));
			log(dim(`  Full list saved to ${logFile} (inside the gallery's data folder).`));
		}
		log(
			dim(
				'\n  Old links (/album/<slug>, /album/<slug>/photo/<id>) redirect to the imported albums.'
			)
		);
		log(
			dim(
				'  Admin login is not imported: the new gallery uses ADMIN_USERNAME / ADMIN_PASSWORD from its own .env.'
			)
		);

		db.close();
		return aborted ? 130 : failures.length ? 2 : 0;
	} finally {
		await cleanup();
		closeInput();
	}
}

main().then(
	(code) => process.exit(code ?? 0),
	(error) => {
		endStatus();
		console.error(red(`\nImport failed: ${error.message}`));
		closeInput();
		process.exit(1);
	}
);
