import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
	DATA_DIR,
	IMPORT_DIR,
	ADMIN_USERNAME,
	ADMIN_PASSWORD,
	SESSION_SECRET
} from '$app/env/private';

export const dataDir = path.resolve(DATA_DIR);
export const importDir = path.resolve(IMPORT_DIR ?? path.join(dataDir, 'import'));

export const paths = {
	db: path.join(dataDir, 'gallery.db'),
	originals: path.join(dataDir, 'photos', 'originals'),
	thumbs: path.join(dataDir, 'photos', 'thumbs'),
	medium: path.join(dataDir, 'photos', 'medium'),
	site: path.join(dataDir, 'site'),
	tmp: path.join(dataDir, 'tmp')
};

export function ensureDirs() {
	for (const dir of [dataDir, paths.originals, paths.thumbs, paths.medium, paths.site, paths.tmp]) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

/** Reads a generated secret from disk, creating it the first time. */
function persistedSecret(file: string, create: () => string): string {
	const full = path.join(dataDir, file);
	try {
		const existing = fs.readFileSync(full, 'utf8').trim();
		if (existing) return existing;
	} catch {
		// not created yet
	}
	fs.mkdirSync(dataDir, { recursive: true });
	const value = create();
	fs.writeFileSync(full, value + '\n', { mode: 0o600 });
	return value;
}

let secret: Buffer | undefined;

export function sessionSecret(): Buffer {
	if (!secret) {
		const value =
			SESSION_SECRET ??
			persistedSecret('.session-secret', () => crypto.randomBytes(32).toString('hex'));
		secret = Buffer.from(value);
	}
	return secret;
}

let credentials: { username: string; password: string } | undefined;

export function adminCredentials() {
	if (!credentials) {
		let password = ADMIN_PASSWORD;
		if (!password) {
			let generated = false;
			password = persistedSecret('.admin-password', () => {
				generated = true;
				return crypto.randomBytes(12).toString('base64url');
			});
			if (generated) {
				console.log(
					`\n[gallery] No ADMIN_PASSWORD set. Generated one for user "${ADMIN_USERNAME}": ${password}\n` +
						`[gallery] It is stored in ${path.join(dataDir, '.admin-password')}\n`
				);
			}
		}
		credentials = { username: ADMIN_USERNAME, password };
	}
	return credentials;
}
