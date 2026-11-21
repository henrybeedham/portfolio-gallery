/**
 * Database backups: listed, made by hand, downloaded, restored and deleted from the Backups page.
 * db.ts saves one automatically before every update. A full copy with the original photos and
 * videos is only ever streamed as a download, never stored, so it doesn't double the disk space.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BACKUP_NAME, vacuumInto, type BackupReason } from './backup-files.js';
import { resetInvoiceSettings } from './billing.js';
import { paths } from './config.js';
import {
	backupDatabase,
	getDb,
	OLDEST_SCHEMA_VERSION,
	replaceDatabase,
	SCHEMA_VERSION
} from './db.js';
import { resetSettings } from './settings.js';
import { customThemesDir } from './themes.js';
import { zipResponse, type ZipFile } from './zip.js';
import { todayIso } from '#lib/utils.js';

export interface Backup {
	name: string;
	reason: BackupReason;
	createdAt: string;
	size: number;
}

export function listBackups(): Backup[] {
	let names: string[];
	try {
		names = fs.readdirSync(paths.backups);
	} catch {
		return [];
	}
	return names
		.flatMap((name) => {
			const match = BACKUP_NAME.exec(name);
			if (!match) return [];
			const createdAt = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');
			const size = fs.statSync(path.join(paths.backups, name)).size;
			return [{ name, reason: match[2] as BackupReason, createdAt, size }];
		})
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The file for a backup, or null for any name that isn't one, so names can't reach other files. */
export function backupPath(name: string): string | null {
	if (!BACKUP_NAME.test(name)) return null;
	const file = path.join(paths.backups, name);
	return fs.existsSync(file) ? file : null;
}

export function createBackup() {
	return backupDatabase('manual');
}

export function deleteBackup(name: string): boolean {
	const file = backupPath(name);
	if (!file) return false;
	fs.rmSync(file, { force: true });
	return true;
}

/** Why a backup can't be restored, or null if it can. */
function checkBackup(file: string): string | null {
	let check: DatabaseSync | undefined;
	try {
		check = new DatabaseSync(file, { readOnly: true });
		const { quick_check } = check.prepare('PRAGMA quick_check').get() as { quick_check: string };
		const { user_version } = check.prepare('PRAGMA user_version').get() as {
			user_version: number;
		};
		const albums = check
			.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'albums'`)
			.get();
		if (quick_check !== 'ok' || !albums)
			return 'That backup is damaged, or isn’t a gallery backup.';
		if (user_version > SCHEMA_VERSION) return 'That backup was made by a newer version of the app.';
		if (user_version < OLDEST_SCHEMA_VERSION)
			return 'That backup is from a version of the app too old to restore.';
		return null;
	} catch {
		return 'That backup couldn’t be read.';
	} finally {
		check?.close();
	}
}

/**
 * Puts a backup in place of the database, after backing up the database as it is. A backup from an
 * earlier version is brought up to date as it opens. Returns why it couldn't, if it couldn't.
 */
export function restoreBackup(name: string): string | null {
	const file = backupPath(name);
	if (!file) return 'That backup no longer exists.';
	const problem = checkBackup(file);
	if (problem) return problem;

	backupDatabase('restore');
	const staging = `${paths.db}.restoring`;
	fs.copyFileSync(file, staging);
	replaceDatabase(() => {
		// The database was closed cleanly, so its write-ahead log holds nothing that isn't in the file.
		for (const suffix of ['-wal', '-shm']) fs.rmSync(paths.db + suffix, { force: true });
		fs.renameSync(staging, paths.db);
	});
	resetSettings();
	resetInvoiceSettings();
	return null;
}

async function filesUnder(dir: string, prefix: string): Promise<ZipFile[]> {
	try {
		const names = await fsp.readdir(dir, { recursive: true });
		return names.sort().map((name) => ({
			name: `${prefix}/${name.split(path.sep).join('/')}`,
			file: path.join(dir, name)
		}));
	} catch {
		return [];
	}
}

/**
 * Everything needed to rebuild the site, as one ZIP: the database, every original photo and video,
 * the hero image and uploaded themes. Thumbnails are left out; they're made again when needed.
 */
export async function everythingResponse(request: Request): Promise<Response> {
	fs.mkdirSync(paths.tmp, { recursive: true });
	const snapshot = path.join(paths.tmp, `backup-${crypto.randomBytes(8).toString('hex')}.db`);
	vacuumInto(getDb(), snapshot);
	const cleanUp = () => fs.rm(snapshot, { force: true }, () => {});
	try {
		const files: ZipFile[] = [
			{ name: 'gallery.db', file: snapshot },
			...(await filesUnder(paths.originals, 'photos/originals')),
			...(await filesUnder(paths.site, 'site')),
			...(await filesUnder(customThemesDir, 'themes'))
		];
		// The database copy is new each time, so this archive can't be resumed.
		return await zipResponse(request, files, `Gallery backup ${todayIso()}.zip`, {
			resumable: false,
			onClose: cleanUp
		});
	} catch (error) {
		cleanUp();
		throw error;
	}
}
