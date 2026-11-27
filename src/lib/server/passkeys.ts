/**
 * Passkeys (WebAuthn) for the admin sign-in, alongside the password, with `node:crypto` only.
 *
 * Registration asks for no attestation, so the browser's own `getPublicKey()` supplies the key and
 * no CBOR decoding is needed; it happens while signed in, so there's nothing to gain from trusting
 * the authenticator's maker. Signing in checks the challenge, origin, relying party, user presence
 * and signature, and refuses a signature counter that goes backwards (a cloned key).
 */
import crypto from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import { sign, unsign } from './auth.js';
import { adminCredentials, sessionSecret } from './config.js';
import { all, get, run } from './db.js';
import { getSettings } from './settings.js';

const CHALLENGE_COOKIE = 'gallery_webauthn';
const CHALLENGE_SECONDS = 300;
/** ES256, EdDSA and RS256, in the order browsers should prefer them. */
const ALGORITHMS = [-7, -8, -257];

type Purpose = 'register' | 'login';

export interface Passkey {
	id: string;
	name: string;
	createdAt: string;
	lastUsedAt: string | null;
}

interface PasskeyRow {
	id: string;
	public_key: Uint8Array;
	algorithm: number;
	sign_count: number;
	name: string;
	transports: string;
	created_at: string;
	last_used_at: string | null;
}

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const sha256 = (data: string | Uint8Array) => crypto.createHash('sha256').update(data).digest();

/** The relying party is this site's host name, so passkeys are tied to the address it's served at. */
function relyingParty(event: Pick<RequestEvent, 'url'>) {
	return { id: event.url.hostname, origin: event.url.origin };
}

/** A stable, opaque id for the single admin account. */
function userHandle() {
	return crypto
		.createHmac('sha256', sessionSecret())
		.update('passkey-user')
		.digest()
		.subarray(0, 16);
}

/* ---------------------------------------------------------------- challenges */

/** Challenges already answered, so a captured response can't be replayed while its cookie lasts. */
const used = new Map<string, number>();

function issueChallenge(event: Pick<RequestEvent, 'cookies' | 'url'>, purpose: Purpose) {
	const challenge = b64url(crypto.randomBytes(32));
	const payload = Buffer.from(
		JSON.stringify({ c: challenge, p: purpose, e: Date.now() + CHALLENGE_SECONDS * 1000 })
	).toString('base64url');
	event.cookies.set(CHALLENGE_COOKIE, sign(payload), {
		path: '/admin',
		httpOnly: true,
		sameSite: 'strict',
		secure: event.url.protocol === 'https:',
		maxAge: CHALLENGE_SECONDS
	});
	return challenge;
}

/** The challenge this browser was given for `purpose`, used up by reading it. */
function takeChallenge(event: Pick<RequestEvent, 'cookies' | 'url'>, purpose: Purpose) {
	const payload = unsign(event.cookies.get(CHALLENGE_COOKIE));
	event.cookies.delete(CHALLENGE_COOKIE, { path: '/admin' });
	if (!payload) return null;
	try {
		const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		const now = Date.now();
		for (const [key, expires] of used) if (expires < now) used.delete(key);
		if (data.p !== purpose || typeof data.c !== 'string' || data.e < now || used.has(data.c)) {
			return null;
		}
		used.set(data.c, data.e);
		return data.c as string;
	} catch {
		return null;
	}
}

/* -------------------------------------------------------------- client data */

/** A problem to show the person signing in, rather than a server error. */
export class PasskeyError extends Error {}

function decode(value: unknown, what: string): Buffer {
	if (typeof value !== 'string' || !/^[\w-]*$/.test(value))
		throw new PasskeyError(`Missing ${what}.`);
	return Buffer.from(value, 'base64url');
}

/** Checks `clientDataJSON` was made for this site, this ceremony and this challenge. */
function checkClientData(raw: Buffer, type: string, challenge: string, origin: string) {
	let data: { type?: string; challenge?: string; origin?: string; crossOrigin?: boolean };
	try {
		data = JSON.parse(raw.toString('utf8'));
	} catch {
		throw new PasskeyError('The passkey’s response couldn’t be read.');
	}
	if (data.type !== type) throw new PasskeyError('The passkey’s response was for something else.');
	if (data.challenge !== challenge)
		throw new PasskeyError('That passkey request has expired. Please try again.');
	if (data.origin !== origin || data.crossOrigin) {
		throw new PasskeyError(
			`That passkey was offered for ${data.origin ?? 'another site'}, not ${origin}.`
		);
	}
}

const FLAG_USER_PRESENT = 0x01;

/** The authenticator data's relying party, flags and signature counter. */
function readAuthData(authData: Buffer, rpId: string) {
	if (authData.length < 37) throw new PasskeyError('The passkey’s response was too short.');
	if (!authData.subarray(0, 32).equals(sha256(rpId))) {
		throw new PasskeyError('That passkey belongs to a different site.');
	}
	const flags = authData[32];
	if (!(flags & FLAG_USER_PRESENT)) throw new PasskeyError('The passkey wasn’t confirmed.');
	return { signCount: authData.readUInt32BE(33) };
}

/* -------------------------------------------------------------- registration */

export function listPasskeys(): Passkey[] {
	return all<PasskeyRow>('SELECT * FROM passkeys ORDER BY created_at').map((row) => ({
		id: row.id,
		name: row.name,
		createdAt: row.created_at,
		lastUsedAt: row.last_used_at
	}));
}

export function hasPasskeys() {
	return !!get('SELECT 1 FROM passkeys LIMIT 1');
}

/** What the browser needs for `navigator.credentials.create()`, as JSON with base64url bytes. */
export function registrationOptions(event: Pick<RequestEvent, 'cookies' | 'url'>) {
	const rp = relyingParty(event);
	const { username } = adminCredentials();
	return {
		challenge: issueChallenge(event, 'register'),
		rp: { id: rp.id, name: getSettings().siteTitle },
		user: {
			id: b64url(userHandle()),
			name: username,
			displayName: `${getSettings().siteTitle} admin`
		},
		pubKeyCredParams: ALGORITHMS.map((alg) => ({ type: 'public-key', alg })),
		timeout: CHALLENGE_SECONDS * 1000,
		attestation: 'none',
		authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
		excludeCredentials: all<{ id: string; transports: string }>(
			'SELECT id, transports FROM passkeys'
		).map((row) => ({
			type: 'public-key',
			id: row.id,
			transports: row.transports ? row.transports.split(',') : undefined
		}))
	};
}

export interface RegistrationResponse {
	id: string;
	clientDataJSON: string;
	authenticatorData: string;
	publicKey: string | null;
	publicKeyAlgorithm: number;
	transports?: string[];
}

export function registerPasskey(
	event: Pick<RequestEvent, 'cookies' | 'url'>,
	response: RegistrationResponse,
	name: string
): Passkey {
	const challenge = takeChallenge(event, 'register');
	if (!challenge) throw new PasskeyError('That passkey request has expired. Please try again.');
	const rp = relyingParty(event);
	checkClientData(
		decode(response.clientDataJSON, 'client data'),
		'webauthn.create',
		challenge,
		rp.origin
	);
	const { signCount } = readAuthData(
		decode(response.authenticatorData, 'authenticator data'),
		rp.id
	);

	if (!ALGORITHMS.includes(response.publicKeyAlgorithm) || !response.publicKey) {
		throw new PasskeyError('This passkey uses a kind of key the site doesn’t support.');
	}
	const publicKey = decode(response.publicKey, 'public key');
	try {
		crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
	} catch {
		throw new PasskeyError('The passkey’s public key couldn’t be read.');
	}
	const id = b64url(decode(response.id, 'credential id'));
	if (!id) throw new PasskeyError('Missing credential id.');
	if (get('SELECT 1 FROM passkeys WHERE id = ?', id)) {
		throw new PasskeyError('That passkey has already been added.');
	}
	const transports = (response.transports ?? [])
		.filter((item) => typeof item === 'string' && /^[a-z-]{1,20}$/.test(item))
		.join(',');
	run(
		`INSERT INTO passkeys (id, public_key, algorithm, sign_count, name, transports)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		id,
		publicKey,
		response.publicKeyAlgorithm,
		signCount,
		name.trim().slice(0, 60) || 'Passkey',
		transports
	);
	return listPasskeys().find((passkey) => passkey.id === id)!;
}

export function deletePasskey(id: string) {
	return run('DELETE FROM passkeys WHERE id = ?', id).changes > 0;
}

/* ------------------------------------------------------------------- sign-in */

/** What the browser needs for `navigator.credentials.get()`. Any of the site's passkeys will do. */
export function loginOptions(event: Pick<RequestEvent, 'cookies' | 'url'>) {
	return {
		challenge: issueChallenge(event, 'login'),
		rpId: relyingParty(event).id,
		timeout: CHALLENGE_SECONDS * 1000,
		userVerification: 'preferred',
		allowCredentials: []
	};
}

export interface LoginResponse {
	id: string;
	clientDataJSON: string;
	authenticatorData: string;
	signature: string;
}

/** Verifies a passkey sign-in. Throws a PasskeyError saying what's wrong. */
export function verifyLogin(event: Pick<RequestEvent, 'cookies' | 'url'>, response: LoginResponse) {
	const challenge = takeChallenge(event, 'login');
	if (!challenge) throw new PasskeyError('That passkey request has expired. Please try again.');
	const id = b64url(decode(response.id, 'credential id'));
	const row = get<PasskeyRow>('SELECT * FROM passkeys WHERE id = ?', id);
	if (!row)
		throw new PasskeyError('That passkey isn’t set up for this site. Sign in with your password.');

	const rp = relyingParty(event);
	const clientData = decode(response.clientDataJSON, 'client data');
	const authData = decode(response.authenticatorData, 'authenticator data');
	checkClientData(clientData, 'webauthn.get', challenge, rp.origin);
	const { signCount } = readAuthData(authData, rp.id);

	const key = crypto.createPublicKey({
		key: Buffer.from(row.public_key),
		format: 'der',
		type: 'spki'
	});
	const signed = Buffer.concat([authData, sha256(clientData)]);
	const signature = decode(response.signature, 'signature');
	const valid =
		row.algorithm === -8
			? crypto.verify(null, signed, key, signature)
			: crypto.verify('sha256', signed, key, signature);
	if (!valid) throw new PasskeyError('The passkey’s signature didn’t match.');

	// Authenticators that count (most synced passkeys always send 0) must count upwards.
	if ((signCount > 0 || row.sign_count > 0) && signCount <= row.sign_count) {
		throw new PasskeyError(
			'This passkey may have been copied. Sign in with your password and remove it.'
		);
	}
	run(
		`UPDATE passkeys SET sign_count = ?, last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
		signCount,
		id
	);
}
