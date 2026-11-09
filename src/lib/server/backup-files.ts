/**
 * Database backups on disk: `DATA_DIR/backups/gallery-<time>-<reason>.db`. Kept apart from
 * backups.ts so db.ts can take one before migrating without importing itself.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { paths } from './config.js';

export type BackupReason = 'update' | 'manual' | 'restore';

export const BACKUP_NAME =
	/^gallery-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-(update|manual|restore)\.db$/;

/** Backups taken automatically (before an update or a restore); older ones are deleted. */
const KEEP_AUTOMATIC = 10;

/** A compact, consistent copy of the database, written while it stays in use. */
export function vacuumInto(instance: DatabaseSync, file: string) {
	instance.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
}

export function writeBackup(instance: DatabaseSync, reason: BackupReason): string {
	fs.mkdirSync(paths.backups, { recursive: true });
	const name = `gallery-${new Date().toISOString().replace(/[:.]/g, '-')}-${reason}.db`;
	vacuumInto(instance, path.join(paths.backups, name));
	pruneAutomatic();
	return name;
}

function pruneAutomatic() {
	const automatic = fs
		.readdirSync(paths.backups)
		.filter((name) => /-(update|restore)\.db$/.test(name) && BACKUP_NAME.test(name))
		.sort()
		.reverse();
	for (const name of automatic.slice(KEEP_AUTOMATIC)) {
		fs.rmSync(path.join(paths.backups, name), { force: true });
	}
}
