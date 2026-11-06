import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { adminCredentials, sessionSecret } from './config.js';
import type { Album } from './albums.js';

const SESSION_COOKIE = 'gallery_session';
const SESSION_DAYS = 30;

const scrypt = promisify(crypto.scrypt) as (
	password: crypto.BinaryLike,
	salt: crypto.BinaryLike,
	keylen: number,
	options: crypto.ScryptOptions
) => Promise<Buffer>;

function hmac(value: string) {
	return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function safeEqual(a: string, b: string) {
	const ha = crypto.createHash('sha256').update(a).digest();
	const hb = crypto.createHash('sha256').update(b).digest();
	return crypto.timingSafeEqual(ha, hb);
}

export function sign(value: string) {
	return `${value}.${hmac(value)}`;
}

export function unsign(signed: string | undefined): string | null {
	if (!signed) return null;
	const index = signed.lastIndexOf('.');
	if (index < 0) return null;
	const value = signed.slice(0, index);
	return safeEqual(hmac(value), signed.slice(index + 1)) ? value : null;
}

function cookieOptions(event: Pick<RequestEvent, 'url'>) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: event.url.protocol === 'https:'
	};
}

/* -------------------------------------------------------------------- admin */

export function checkAdminCredentials(username: string, password: string) {
	const expected = adminCredentials();
	// Evaluate both comparisons to avoid leaking which one failed through timing.
	const userOk = safeEqual(username, expected.username);
	const passOk = safeEqual(password, expected.password);
	return userOk && passOk;
}

/**
 * Ties sessions to the current credentials: changing ADMIN_USERNAME or ADMIN_PASSWORD signs out
 * every existing session.
 */
function credentialStamp() {
	const { username, password } = adminCredentials();
	return hmac(`admin-credentials:${username}:${password}`).slice(0, 22);
}

export function createAdminSession(event: Pick<RequestEvent, 'cookies' | 'url'>) {
	const expires = Date.now() + SESSION_DAYS * 864e5;
	const payload = Buffer.from(
		JSON.stringify({ u: adminCredentials().username, c: credentialStamp(), e: expires })
	).toString('base64url');
	event.cookies.set(SESSION_COOKIE, sign(payload), {
		...cookieOptions(event),
		maxAge: SESSION_DAYS * 86400
	});
}

export function destroyAdminSession(event: Pick<RequestEvent, 'cookies' | 'url'>) {
	event.cookies.delete(SESSION_COOKIE, cookieOptions(event));
}

export function isAdminSession(cookies: Cookies): boolean {
	const payload = unsign(cookies.get(SESSION_COOKIE));
	if (!payload) return false;
	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		return (
			data.u === adminCredentials().username &&
			typeof data.c === 'string' &&
			safeEqual(data.c, credentialStamp()) &&
			typeof data.e === 'number' &&
			data.e > Date.now()
		);
	} catch {
		return false;
	}
}

/* ---------------------------------------------------------- album passwords */

export function hashPassword(password: string): string {
	const salt = crypto.randomBytes(16);
	const hash = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
	return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

/** Runs off the main thread so a burst of unlock attempts can't stall the server. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
	if (!stored) return false;
	const [scheme, salt, hash] = stored.split('$');
	if (scheme !== 'scrypt' || !salt || !hash) return false;
	const expected = Buffer.from(hash, 'base64url');
	const actual = await scrypt(password, Buffer.from(salt, 'base64url'), expected.length, {
		N: 16384,
		r: 8,
		p: 1
	});
	return crypto.timingSafeEqual(actual, expected);
}

/** Changing the album password changes the fingerprint, which invalidates earlier unlocks. */
function fingerprint(album: Pick<Album, 'id' | 'passwordHash'>) {
	return crypto
		.createHash('sha256')
		.update(`${album.id}:${album.passwordHash ?? ''}`)
		.digest('base64url')
		.slice(0, 16);
}

function unlockCookie(albumId: number) {
	return `gallery_album_${albumId}`;
}

export function unlockAlbum(
	event: Pick<RequestEvent, 'cookies' | 'url'>,
	album: Pick<Album, 'id' | 'passwordHash'>
) {
	// A session cookie: the gallery stays unlocked until the browser session ends.
	event.cookies.set(unlockCookie(album.id), sign(fingerprint(album)), cookieOptions(event));
}

export function isAlbumUnlocked(cookies: Cookies, album: Pick<Album, 'id' | 'passwordHash'>) {
	if (!album.passwordHash) return true;
	return unsign(cookies.get(unlockCookie(album.id))) === fingerprint(album);
}
