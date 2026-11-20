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
	previews: path.join(dataDir, 'photos', 'previews'),
	site: path.join(dataDir, 'site'),
	tmp: path.join(dataDir, 'tmp'),
	backups: path.join(dataDir, 'backups')
};

export function ensureDirs() {
	for (const dir of [dataDir, paths.originals, paths.thumbs, paths.medium, paths.site, paths.tmp]) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

/** Reads a generated secret from disk, creating it the first time. */
export function persistedSecret(file: string, create: () => string): string {
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

const WEAK_PASSWORDS = new Set(['change-me', 'changeme', 'password', 'admin']);

let credentials: { username: string; password: string } | undefined;

export function adminCredentials() {
	if (!credentials) {
		let password = ADMIN_PASSWORD;
		if (password && WEAK_PASSWORDS.has(password.trim().toLowerCase())) {
			throw new Error(
				`[gallery] ADMIN_PASSWORD is set to the placeholder "${password}". Choose a real password, ` +
					'or remove ADMIN_PASSWORD to have one generated.'
			);
		}
		if (password && password.length < 12) {
			console.warn(
				'[gallery] ADMIN_PASSWORD is shorter than 12 characters. Consider a longer one.'
			);
		}
		if (!password) {
			let generated = false;
			password = persistedSecret('.admin-password', () => {
				generated = true;
				return crypto.randomBytes(12).toString('base64url');
			});
			if (generated) {
				// The password itself isn't logged, so it doesn't end up in log files or log shippers.
				console.log(
					`\n[gallery] No ADMIN_PASSWORD set. Generated one for user "${ADMIN_USERNAME}".\n` +
						`[gallery] Read it from ${path.join(dataDir, '.admin-password')}\n`
				);
			}
		}
		credentials = { username: ADMIN_USERNAME, password };
	}
	return credentials;
}
