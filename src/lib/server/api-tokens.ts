/**
 * Tokens for apps that talk to the site on your behalf, such as the Lightroom plugin. A token is
 * shown once when it's made; only its SHA-256 hash is stored. A 'full' token has the same power as
 * being signed in; a 'widget' token can only read the widget summary. Revoke any you no longer use.
 */
import crypto from 'node:crypto';
import { all, get, run } from './db.js';

export type TokenScope = 'full' | 'widget';

export interface ApiToken {
	id: number;
	name: string;
	createdAt: string;
	lastUsedAt: string | null;
}

const PREFIX = 'gal_';

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function listApiTokens(scope: TokenScope): ApiToken[] {
	return all<{ id: number; name: string; created_at: string; last_used_at: string | null }>(
		`SELECT id, name, created_at, last_used_at FROM api_tokens WHERE scope = ?
		 ORDER BY created_at DESC, id DESC`,
		scope
	).map((row) => ({
		id: row.id,
		name: row.name,
		createdAt: row.created_at,
		lastUsedAt: row.last_used_at
	}));
}

/** Makes a token and returns it in full. This is the only time it can be seen. */
export function createApiToken(name: string, scope: TokenScope): string {
	const token = PREFIX + crypto.randomBytes(32).toString('base64url');
	run(
		'INSERT INTO api_tokens (name, token_hash, scope) VALUES (?, ?, ?)',
		name,
		hash(token),
		scope
	);
	return token;
}

export function revokeApiToken(id: number, scope: TokenScope) {
	run('DELETE FROM api_tokens WHERE id = ? AND scope = ?', id, scope);
}

/**
 * The token's id if it's valid and allowed `scope`, noting when it was used. A full token can do
 * anything a widget token can.
 */
export function verifyApiToken(token: string, scope: TokenScope): number | null {
	if (!token.startsWith(PREFIX) || token.length > 200) return null;
	const row = get<{ id: number; scope: string }>(
		'SELECT id, scope FROM api_tokens WHERE token_hash = ?',
		hash(token)
	);
	if (!row || (scope === 'full' && row.scope !== 'full')) return null;
	run(
		"UPDATE api_tokens SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
		row.id
	);
	return row.id;
}
