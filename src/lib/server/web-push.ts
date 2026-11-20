/**
 * The Web Push protocol, with nothing but node:crypto: payload encryption (RFC 8291, aes128gcm)
 * and the VAPID signature that identifies this server to the push service (RFC 8292).
 */
import crypto from 'node:crypto';

export interface PushSubscriptionKeys {
	endpoint: string;
	p256dh: string;
	auth: string;
}

export interface VapidKeys {
	/** The uncompressed P-256 public key, base64url, as the browser's applicationServerKey. */
	publicKey: string;
	privateKey: crypto.KeyObject;
}

const b64 = (data: Buffer) => data.toString('base64url');
const fromB64 = (text: string) => Buffer.from(text, 'base64url');

/** Record size written into the header. Payloads are far smaller, so there's always one record. */
const RECORD_SIZE = 4096;

export function generateVapidJwk(): JsonWebKey {
	return crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({
		format: 'jwk'
	});
}

export function vapidKeysFromJwk(jwk: JsonWebKey): VapidKeys {
	const privateKey = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
	const publicKey = Buffer.concat([Buffer.from([4]), fromB64(jwk.x!), fromB64(jwk.y!)]);
	return { publicKey: b64(publicKey), privateKey };
}

/**
 * Encrypts a payload for one subscription. `asPrivate` and `salt` are only passed by tests, to
 * reproduce the RFC's worked example; normally both are random.
 */
export function encryptPayload(
	payload: Buffer,
	keys: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
	test?: { asPrivate: Buffer; salt: Buffer }
): Buffer {
	const uaPublic = fromB64(keys.p256dh);
	const authSecret = fromB64(keys.auth);
	if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('Invalid push keys');

	const ecdh = crypto.createECDH('prime256v1');
	if (test) ecdh.setPrivateKey(test.asPrivate);
	else ecdh.generateKeys();
	const asPublic = ecdh.getPublicKey();
	const sharedSecret = ecdh.computeSecret(uaPublic);
	const salt = test?.salt ?? crypto.randomBytes(16);

	const hkdf = (ikm: Buffer, salt: Buffer, info: Buffer, length: number) =>
		Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, length));

	const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
	const ikm = hkdf(sharedSecret, authSecret, keyInfo, 32);
	const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
	const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);

	const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
	// 0x02 marks the last (and only) record, with no padding after it.
	const body = Buffer.concat([
		cipher.update(Buffer.concat([payload, Buffer.from([2])])),
		cipher.final(),
		cipher.getAuthTag()
	]);

	const header = Buffer.alloc(21);
	salt.copy(header, 0);
	header.writeUInt32BE(RECORD_SIZE, 16);
	header.writeUInt8(asPublic.length, 20);
	return Buffer.concat([header, asPublic, body]);
}

/** The `Authorization` header value for a request to this push service. */
export function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string): string {
	const header = b64(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
	const claims = b64(
		Buffer.from(
			JSON.stringify({
				aud: new URL(endpoint).origin,
				exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
				sub: subject
			})
		)
	);
	const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), {
		key: keys.privateKey,
		dsaEncoding: 'ieee-p1363'
	});
	return `vapid t=${header}.${claims}.${b64(signature)}, k=${keys.publicKey}`;
}
