import { DatabaseSync, type StatementSync, type SQLInputValue } from 'node:sqlite';
import { ensureDirs, paths } from './config.js';
import { moveJobMoneyToInvoices } from './legacy-money.js';

/** SQL, or a function for migrations that convert data. Each runs inside its own transaction. */
type Migration = string | ((db: DatabaseSync) => void);

const MIGRATIONS: Migration[] = [
	`
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
		accent_color TEXT NOT NULL DEFAULT '#2a2723',
		layout TEXT NOT NULL DEFAULT 'grid',
		sort_order TEXT NOT NULL DEFAULT 'oldest',
		cover_photo_id INTEGER,
		background_photo_id INTEGER,
		views INTEGER NOT NULL DEFAULT 0,
		photo_downloads INTEGER NOT NULL DEFAULT 0,
		album_downloads INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);

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
		camera TEXT,
		lens TEXT,
		focal_length REAL,
		aperture REAL,
		exposure_time REAL,
		iso INTEGER,
		downloads INTEGER NOT NULL DEFAULT 0,
		version INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);
	CREATE INDEX photos_album ON photos(album_id);

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
	`,
	// Photography jobs ("bookings" in code; "jobs" is already used for background maintenance tasks),
	// invoices and the saved addresses invoices are billed to.
	`
	CREATE TABLE billing_addresses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		label TEXT NOT NULL,
		organisation TEXT NOT NULL,
		address TEXT NOT NULL DEFAULT '',
		position INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);

	INSERT INTO billing_addresses (label, organisation, address, position) VALUES
		('Guild', 'University of Exeter Students’ Guild', 'Devonshire House\nStocker Road\nExeter\nEX4 4PZ', 1),
		('AU', 'University of Exeter Athletic Union', 'Sports Park\nStocker Road\nExeter\nEX4 4QN', 2);

	CREATE TABLE bookings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		title TEXT NOT NULL,
		client TEXT NOT NULL DEFAULT '',
		billing_address_id INTEGER REFERENCES billing_addresses(id) ON DELETE SET NULL,
		location TEXT NOT NULL DEFAULT '',
		starts_at TEXT,
		hours REAL NOT NULL DEFAULT 0,
		rate INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'confirmed',
		shot INTEGER NOT NULL DEFAULT 0,
		delivered INTEGER NOT NULL DEFAULT 0,
		paid INTEGER NOT NULL DEFAULT 0,
		legacy_invoices TEXT NOT NULL DEFAULT '',
		notes TEXT NOT NULL DEFAULT '',
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
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
		number TEXT NOT NULL UNIQUE,
		booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
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
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);
	CREATE INDEX invoices_booking ON invoices(booking_id);
	`,
	// Per-day gallery activity for the analytics charts (the albums table only keeps running totals).
	`
	CREATE TABLE album_daily_stats (
		album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
		day TEXT NOT NULL,
		views INTEGER NOT NULL DEFAULT 0,
		photo_downloads INTEGER NOT NULL DEFAULT 0,
		album_downloads INTEGER NOT NULL DEFAULT 0,
		PRIMARY KEY (album_id, day)
	);
	CREATE INDEX album_daily_stats_day ON album_daily_stats(day);
	`,
	// Albums can use their own theme (NULL follows the site's), replacing the per-album accent colour.
	`
	ALTER TABLE albums ADD COLUMN theme TEXT;
	ALTER TABLE albums DROP COLUMN accent_color;
	`,
	// Money lives on invoices only. Jobs lose hours, rate, paid and earlier invoice numbers, which
	// become imported records or drafts; invoices gain draft and imported flags.
	moveJobMoneyToInvoices,
	// Jobs can have an end time: a naive local YYYY-MM-DDTHH:mm, the day after for overnight jobs.
	`ALTER TABLE bookings ADD COLUMN ends_at TEXT;`,
	// An invoice can cover several jobs and a job can have several invoices, so the link moves from
	// invoices.booking_id to a table of its own. SQLite can't drop a foreign key column in place.
	`
	CREATE TABLE invoices_new (
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
	INSERT INTO invoices_new (id, number, billing_address_id, issue_date, due_date, bill_to_name,
		bill_to_address, sender, payment_details, notes, items, total, style, paid_at, draft, imported,
		created_at, updated_at)
	SELECT id, number, billing_address_id, issue_date, due_date, bill_to_name, bill_to_address, sender,
		payment_details, notes, items, total, style, paid_at, draft, imported, created_at, updated_at
	FROM invoices;
	CREATE TABLE invoice_bookings (
		invoice_id INTEGER NOT NULL REFERENCES invoices_new(id) ON DELETE CASCADE,
		booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
		PRIMARY KEY (invoice_id, booking_id)
	);
	INSERT INTO invoice_bookings (invoice_id, booking_id)
	SELECT id, booking_id FROM invoices WHERE booking_id IS NOT NULL;
	DROP TABLE invoices;
	ALTER TABLE invoices_new RENAME TO invoices;
	CREATE UNIQUE INDEX invoices_number ON invoices(number) WHERE imported = 0;
	CREATE INDEX invoice_bookings_booking ON invoice_bookings(booking_id);
	`,
	// Album pages and covers read photos in capture order, which this index returns already sorted.
	// It also serves every lookup by album, so it replaces the plain index.
	`
	CREATE INDEX photos_album_chrono ON photos(album_id, COALESCE(taken_at, created_at));
	DROP INDEX photos_album;
	`,
	// Camera settings are no longer shown anywhere. The capture date stays.
	`
	ALTER TABLE photos DROP COLUMN camera;
	ALTER TABLE photos DROP COLUMN lens;
	ALTER TABLE photos DROP COLUMN focal_length;
	ALTER TABLE photos DROP COLUMN aperture;
	ALTER TABLE photos DROP COLUMN exposure_time;
	ALTER TABLE photos DROP COLUMN iso;
	`
];

let db: DatabaseSync | undefined;
const statements = new Map<string, StatementSync>();

function migrate(instance: DatabaseSync) {
	const row = instance.prepare('PRAGMA user_version').get() as { user_version: number };
	for (let version = row.user_version; version < MIGRATIONS.length; version++) {
		instance.exec('BEGIN');
		try {
			const migration = MIGRATIONS[version];
			if (typeof migration === 'string') instance.exec(migration);
			else migration(instance);
			instance.exec(`PRAGMA user_version = ${version + 1}`);
			instance.exec('COMMIT');
		} catch (error) {
			instance.exec('ROLLBACK');
			throw error;
		}
	}
}

/** Opens the database lazily, so nothing touches the disk while the app is being built. */
export function getDb(): DatabaseSync {
	if (!db) {
		ensureDirs();
		const instance = new DatabaseSync(paths.db);
		instance.exec(`
			PRAGMA journal_mode = WAL;
			PRAGMA synchronous = NORMAL;
			PRAGMA foreign_keys = ON;
			PRAGMA busy_timeout = 5000;
		`);
		migrate(instance);
		db = instance;
	}
	return db;
}

export type Param = SQLInputValue | boolean | undefined;

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
