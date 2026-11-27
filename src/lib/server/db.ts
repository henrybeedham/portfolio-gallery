import { DatabaseSync, type StatementSync, type SQLInputValue } from 'node:sqlite';
import { version } from '$app/env';
import { writeBackup, type BackupReason } from './backup-files.js';
import { ensureDirs, paths } from './config.js';

/** SQL, or a function for migrations that convert data. Each runs inside its own transaction. */
type Migration = string | ((db: DatabaseSync) => void);

/**
 * The schema after the first 18 migrations, which have been folded into it. A new database starts
 * here. One older than this must first be opened by a build from before the fold (commit ff17783),
 * which brings it up to version 18.
 */
const BASELINE_VERSION = 18;

const BASELINE = `
	CREATE TABLE settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE albums (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		description TEXT NOT NULL DEFAULT '',
		album_date TEXT,
		is_public INTEGER NOT NULL DEFAULT 1,
		show_on_home INTEGER NOT NULL DEFAULT 0,
		show_on_galleries INTEGER NOT NULL DEFAULT 1,
		is_featured INTEGER NOT NULL DEFAULT 0,
		password_hash TEXT,
		expires_at TEXT,
		layout TEXT NOT NULL DEFAULT 'grid',
		sort_order TEXT NOT NULL DEFAULT 'oldest',
		cover_photo_id INTEGER,
		background_photo_id INTEGER,
		views INTEGER NOT NULL DEFAULT 0,
		photo_downloads INTEGER NOT NULL DEFAULT 0,
		album_downloads INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		-- NULL follows the site's theme.
		theme TEXT,
		-- Whether the album page opens with its sections collapsed to a few small previews.
		sections_collapsed INTEGER NOT NULL DEFAULT 0
	);

	-- Named, ordered parts of an album (e.g. “Day 1 — Film”). A photo is in at most one; deleting a
	-- section leaves its photos in the album without one (sections.ts).
	CREATE TABLE sections (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		position INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);
	CREATE INDEX sections_album ON sections(album_id, position);

	-- Photos and videos (kind), with a video's poster frame as its thumbnail.
	CREATE TABLE photos (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
		key TEXT NOT NULL UNIQUE,
		ext TEXT NOT NULL,
		original_name TEXT NOT NULL,
		mime TEXT NOT NULL,
		size INTEGER NOT NULL DEFAULT 0,
		width INTEGER NOT NULL DEFAULT 0,
		height INTEGER NOT NULL DEFAULT 0,
		taken_at TEXT,
		downloads INTEGER NOT NULL DEFAULT 0,
		version INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		kind TEXT NOT NULL DEFAULT 'photo',
		duration REAL,
		-- Whether a video has a smaller copy for playing in the browser: NULL not yet decided, 0 plays
		-- the original, 1 has one (video-preview.ts).
		preview INTEGER,
		section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL
	);
	-- Album pages and covers read photos in capture order, which this index returns already sorted.
	CREATE INDEX photos_album_chrono ON photos(album_id, COALESCE(taken_at, created_at));
	CREATE INDEX photos_section ON photos(section_id);

	CREATE TABLE tags (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		UNIQUE(album_id, name)
	);

	CREATE TABLE photo_tags (
		photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
		tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
		PRIMARY KEY (photo_id, tag_id)
	);
	CREATE INDEX photo_tags_tag ON photo_tags(tag_id);

	-- Per-day gallery activity for the analytics charts (albums only keep running totals).
	CREATE TABLE album_daily_stats (
		album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
		day TEXT NOT NULL,
		views INTEGER NOT NULL DEFAULT 0,
		photo_downloads INTEGER NOT NULL DEFAULT 0,
		album_downloads INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (album_id, day)
	);
	CREATE INDEX album_daily_stats_day ON album_daily_stats(day);

	CREATE TABLE billing_addresses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		label TEXT NOT NULL,
		organisation TEXT NOT NULL,
		address TEXT NOT NULL DEFAULT '',
		position INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);

	-- Photography jobs ("bookings" in code; "jobs" is already used for background maintenance tasks).
	-- They hold no money: that comes from their invoices. "shot" is no longer used.
	CREATE TABLE bookings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		client TEXT NOT NULL DEFAULT '',
		billing_address_id INTEGER REFERENCES billing_addresses(id) ON DELETE SET NULL,
		location TEXT NOT NULL DEFAULT '',
		starts_at TEXT,
		status TEXT NOT NULL DEFAULT 'confirmed',
		shot INTEGER NOT NULL DEFAULT 0,
		delivered INTEGER NOT NULL DEFAULT 0,
		notes TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		-- A naive local YYYY-MM-DDTHH:mm, the day after the start for overnight jobs.
		ends_at TEXT
	);
	CREATE INDEX bookings_starts ON bookings(starts_at);

	CREATE TABLE booking_albums (
		booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
		album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
		PRIMARY KEY (booking_id, album_id)
	);
	CREATE INDEX booking_albums_album ON booking_albums(album_id);

	CREATE TABLE invoices (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		number TEXT NOT NULL DEFAULT '',
		billing_address_id INTEGER REFERENCES billing_addresses(id) ON DELETE SET NULL,
		issue_date TEXT NOT NULL,
		due_date TEXT,
		bill_to_name TEXT NOT NULL DEFAULT '',
		bill_to_address TEXT NOT NULL DEFAULT '',
		sender TEXT NOT NULL DEFAULT '{}',
		payment_details TEXT NOT NULL DEFAULT '',
		notes TEXT NOT NULL DEFAULT '',
		items TEXT NOT NULL DEFAULT '[]',
		total INTEGER NOT NULL DEFAULT 0,
		style TEXT NOT NULL DEFAULT 'light',
		paid_at TEXT,
		draft INTEGER NOT NULL DEFAULT 0,
		imported INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);
	-- Imported records may share or lack a number, so only real invoices must be unique.
	CREATE UNIQUE INDEX invoices_number ON invoices(number) WHERE imported = 0;

	-- An invoice can cover several jobs and a job can have several invoices.
	CREATE TABLE invoice_bookings (
		invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
		booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
		PRIMARY KEY (invoice_id, booking_id)
	);
	CREATE INDEX invoice_bookings_booking ON invoice_bookings(booking_id);

	-- Tokens that let apps use the API. Only a hash is kept. scope is 'full' (Lightroom: anything the
	-- admin can) or 'widget' (only read the summary that Home Screen widgets show, /api/widget).
	CREATE TABLE api_tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		token_hash TEXT NOT NULL UNIQUE,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		last_used_at TEXT,
		scope TEXT NOT NULL DEFAULT 'full'
	);

	-- Browsers (usually the admin's phone, installed to the home screen) that get push
	-- notifications. The endpoint is the push service's URL for that browser (push.ts).
	CREATE TABLE push_subscriptions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		endpoint TEXT NOT NULL UNIQUE,
		p256dh TEXT NOT NULL,
		auth TEXT NOT NULL,
		name TEXT NOT NULL,
		subject TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);
`;

/** Changes since the baseline, in order: entry i takes the schema to BASELINE_VERSION + i + 1. */
const MIGRATIONS: Migration[] = [
	// 19: the /galleries page is gone, so an album listed there now shows on the homepage, and the
	// featured album moves from a per-album flag to the site settings (`featuredAlbumId`).
	(db) => {
		const featured = db
			.prepare('SELECT id FROM albums WHERE is_featured = 1 ORDER BY updated_at DESC LIMIT 1')
			.get() as { id: number } | undefined;
		const row = db.prepare(`SELECT value FROM settings WHERE key = 'site'`).get() as
			{ value: string } | undefined;
		let site: Record<string, unknown> = {};
		try {
			site = row ? JSON.parse(row.value) : {};
		} catch {
			site = {};
		}
		site.featuredAlbumId = featured?.id ?? null;
		if (site.defaultShowOnGalleries) site.defaultShowOnHome = true;
		delete site.defaultShowOnGalleries;
		db.prepare(
			`INSERT INTO settings (key, value) VALUES ('site', ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
		).run(JSON.stringify(site));
		db.exec(`
			UPDATE albums SET show_on_home = 1 WHERE show_on_galleries = 1;
			ALTER TABLE albums DROP COLUMN show_on_galleries;
			ALTER TABLE albums DROP COLUMN is_featured;
		`);
	},
	// 20: a photo's caption from its metadata (its alt text), and a tiny blurred copy shown while
	// the thumbnail loads (placeholders.ts), filled in for existing photos in the background.
	`ALTER TABLE photos ADD COLUMN caption TEXT;
	 ALTER TABLE photos ADD COLUMN placeholder TEXT;`,
	// 21: enquiries sent from the homepage form (enquiries.ts). One can become a tentative job.
	`CREATE TABLE enquiries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		email TEXT NOT NULL,
		phone TEXT NOT NULL DEFAULT '',
		-- The date they asked about, YYYY-MM-DD, if any.
		event_date TEXT,
		location TEXT NOT NULL DEFAULT '',
		message TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		read_at TEXT,
		archived INTEGER NOT NULL DEFAULT 0,
		booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL
	);
	CREATE INDEX enquiries_created ON enquiries(created_at);`,
	// 22: passkeys for signing in to the admin area (passkeys.ts), alongside the password.
	`CREATE TABLE passkeys (
		-- The credential id, base64url.
		id TEXT PRIMARY KEY,
		-- The public key as DER SubjectPublicKeyInfo, and its COSE algorithm (-7 ES256, -257 RS256, -8 EdDSA).
		public_key BLOB NOT NULL,
		algorithm INTEGER NOT NULL,
		sign_count INTEGER NOT NULL DEFAULT 0,
		name TEXT NOT NULL,
		transports TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		last_used_at TEXT
	);`
];

/** The schema version this build of the app expects. */
export const SCHEMA_VERSION = BASELINE_VERSION + MIGRATIONS.length;

/** The oldest schema this build can bring up to date (a database, or a backup to restore). */
export const OLDEST_SCHEMA_VERSION = BASELINE_VERSION;

let db: DatabaseSync | undefined;
const statements = new Map<string, StatementSync>();

/** Runs one step in its own transaction, recording the schema version it reaches. */
function step(instance: DatabaseSync, to: number, apply: () => void) {
	instance.exec('BEGIN');
	try {
		apply();
		instance.exec(`PRAGMA user_version = ${to}`);
		instance.exec('COMMIT');
	} catch (error) {
		instance.exec('ROLLBACK');
		throw error;
	}
}

function migrate(instance: DatabaseSync) {
	const row = instance.prepare('PRAGMA user_version').get() as { user_version: number };
	let current = row.user_version;
	if (current > 0 && current < BASELINE_VERSION) {
		throw new Error(
			`[gallery] The database is at schema version ${current}, older than this version of the app can update. Run a build from commit ff17783 once to bring it up to version ${BASELINE_VERSION}, then this one.`
		);
	}
	if (current === 0) {
		step(instance, BASELINE_VERSION, () => instance.exec(BASELINE));
		current = BASELINE_VERSION;
	}
	for (let version = current; version < SCHEMA_VERSION; version++) {
		const migration = MIGRATIONS[version - BASELINE_VERSION];
		step(instance, version + 1, () => {
			if (typeof migration === 'string') instance.exec(migration);
			else migration(instance);
		});
	}
}

/**
 * Opens the database and brings it up to date. A backup is saved first whenever this is a new
 * version of the app (a deploy) or migrations are about to run, unless `backupFirst` is false.
 */
function open(backupFirst: boolean): DatabaseSync {
	ensureDirs();
	const instance = new DatabaseSync(paths.db);
	instance.exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA synchronous = NORMAL;
		PRAGMA foreign_keys = ON;
		PRAGMA busy_timeout = 5000;
	`);
	const { user_version: schema } = instance.prepare('PRAGMA user_version').get() as {
		user_version: number;
	};
	if (backupFirst && schema > 0) {
		const stored = instance
			.prepare(`SELECT value FROM settings WHERE key = 'app-version'`)
			.get() as { value: string } | undefined;
		if (schema < SCHEMA_VERSION || stored?.value !== version) writeBackup(instance, 'update');
	}
	migrate(instance);
	instance
		.prepare(
			`INSERT INTO settings (key, value) VALUES ('app-version', ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
		)
		.run(version);
	return instance;
}

/** Opens the database lazily, so nothing touches the disk while the app is being built. */
export function getDb(): DatabaseSync {
	if (!db) db = open(true);
	return db;
}

/** Saves a copy of the database as it is now. */
export function backupDatabase(reason: BackupReason) {
	return writeBackup(getDb(), reason);
}

/**
 * Closes the database so `swap` can replace the file, then opens it again, migrating it if it's from
 * an earlier version. If `swap` fails, the database that was there is opened again.
 */
export function replaceDatabase(swap: () => void) {
	statements.clear();
	db?.close();
	db = undefined;
	try {
		swap();
	} finally {
		db = open(false);
	}
}

type Param = SQLInputValue | boolean | undefined;

function normalise(params: Param[]): SQLInputValue[] {
	return params.map((value) => {
		if (value === undefined) return null;
		if (typeof value === 'boolean') return value ? 1 : 0;
		return value;
	});
}

function statement(sql: string): StatementSync {
	let stmt = statements.get(sql);
	if (!stmt) {
		// Queries with variable-length IN clauses produce many distinct statements; keep the cache bounded.
		if (statements.size > 500) statements.clear();
		stmt = getDb().prepare(sql);
		statements.set(sql, stmt);
	}
	return stmt;
}

export function run(sql: string, ...params: Param[]) {
	const result = statement(sql).run(...normalise(params));
	return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) };
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
	return statement(sql).get(...normalise(params)) as T | undefined;
}

export function all<T>(sql: string, ...params: Param[]): T[] {
	return statement(sql).all(...normalise(params)) as T[];
}

let depth = 0;

/** Runs `fn` inside a transaction. Nested calls join the outer transaction. */
export function transaction<T>(fn: () => T): T {
	const instance = getDb();
	if (depth > 0) return fn();
	depth++;
	instance.exec('BEGIN');
	try {
		const result = fn();
		instance.exec('COMMIT');
		return result;
	} catch (error) {
		instance.exec('ROLLBACK');
		throw error;
	} finally {
		depth--;
	}
}

/** Builds `?, ?, ?` for an IN clause. */
export function placeholders(count: number) {
	return new Array(count).fill('?').join(', ');
}
