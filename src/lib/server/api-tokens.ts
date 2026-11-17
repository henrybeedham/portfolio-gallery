/**
 * Tokens for apps that talk to the site on your behalf, such as the Lightroom plugin. A token is
 * shown once when it's made; only its SHA-256 hash is stored. Each one has the same power as being
 * signed in, so revoke any you no longer use.
 */
import crypto from 'node:crypto';
import { all, get, run } from './db.js';

export interface ApiToken {
	id: number;
	name: string;
	createdAt: string;
	lastUsedAt: string | null;
}

const PREFIX = 'gal_';

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function listApiTokens(): ApiToken[] {
	return all<{ id: number; name: string; created_at: string; last_used_at: string | null }>(
		'SELECT id, name, created_at, last_used_at FROM api_tokens ORDER BY created_at DESC, id DESC'
	).map((row) => ({
		id: row.id,
		name: row.name,
		createdAt: row.created_at,
		lastUsedAt: row.last_used_at
	}));
}

/** Makes a token and returns it in full. This is the only time it can be seen. */
export function createApiToken(name: string): string {
	const token = PREFIX + crypto.randomBytes(32).toString('base64url');
	run('INSERT INTO api_tokens (name, token_hash) VALUES (?, ?)', name, hash(token));
	return token;
}

export function revokeApiToken(id: number) {
	run('DELETE FROM api_tokens WHERE id = ?', id);
}

/** The token's id if it's valid, noting when it was used. */
export function verifyApiToken(token: string): number | null {
	if (!token.startsWith(PREFIX) || token.length > 200) return null;
	const row = get<{ id: number }>('SELECT id FROM api_tokens WHERE token_hash = ?', hash(token));
	if (!row) return null;
	run(
		"UPDATE api_tokens SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
		row.id
	);
	return row.id;
}
