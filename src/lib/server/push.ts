/**
 * Push notifications to the admin's devices: the same events as the Discord webhook (downloads),
 * delivered by the browser's push service. On an iPhone this needs the site added to the Home
 * Screen. The VAPID key pair is generated once and kept in DATA_DIR/.vapid-key.json.
 */
import { persistedSecret } from './config.js';
import { all, get, run } from './db.js';
import { getSettings } from './settings.js';
import {
	encryptPayload,
	generateVapidJwk,
	vapidAuthorization,
	vapidKeysFromJwk,
	type PushSubscriptionKeys,
	type VapidKeys
} from './web-push.js';

export interface PushDevice {
	id: number;
	name: string;
	endpoint: string;
	createdAt: string;
}

export interface PushMessage {
	title: string;
	body?: string;
	/** Opened when the notification is tapped. */
	url?: string;
	/** A notification with the same tag replaces the previous one instead of stacking. */
	tag?: string;
}

let keys: VapidKeys | undefined;

function vapidKeys(): VapidKeys {
	keys ??= vapidKeysFromJwk(
		JSON.parse(persistedSecret('.vapid-key.json', () => JSON.stringify(generateVapidJwk())))
	);
	return keys;
}

export function vapidPublicKey() {
	return vapidKeys().publicKey;
}

/**
 * The push services browsers use (Apple, Google, Mozilla, Microsoft). Endpoints come from the
 * browser, so anything else is refused rather than letting the server POST to arbitrary URLs.
 */
const PUSH_HOSTS =
	/(^|\.)(push\.apple\.com|fcm\.googleapis\.com|googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;

function validEndpoint(endpoint: string) {
	try {
		const url = new URL(endpoint);
		return url.protocol === 'https:' && PUSH_HOSTS.test(url.hostname) && endpoint.length <= 1000;
	} catch {
		return false;
	}
}

/** A readable name for the device, from its user agent. */
function deviceName(userAgent: string) {
	const device = /iPhone/.test(userAgent)
		? 'iPhone'
		: /iPad/.test(userAgent)
			? 'iPad'
			: /Android/.test(userAgent)
				? 'Android'
				: /Macintosh/.test(userAgent)
					? 'Mac'
					: /Windows/.test(userAgent)
						? 'Windows'
						: /Linux/.test(userAgent)
							? 'Linux'
							: 'Browser';
	const browser = /Edg\//.test(userAgent)
		? 'Edge'
		: /Firefox\//.test(userAgent)
			? 'Firefox'
			: /Chrome\//.test(userAgent)
				? 'Chrome'
				: /Safari\//.test(userAgent)
					? 'Safari'
					: '';
	// On iPhone and iPad, push only works from the Home Screen app, so the browser adds nothing.
	return device === 'iPhone' || device === 'iPad' || !browser ? device : `${browser} on ${device}`;
}

export function listPushDevices(): PushDevice[] {
	return all<{ id: number; name: string; endpoint: string; created_at: string }>(
		'SELECT id, name, endpoint, created_at FROM push_subscriptions ORDER BY created_at DESC, id DESC'
	).map((row) => ({
		id: row.id,
		name: row.name,
		endpoint: row.endpoint,
		createdAt: row.created_at
	}));
}

export function hasPushDevices() {
	return !!get('SELECT 1 FROM push_subscriptions LIMIT 1');
}

/**
 * Saves (or refreshes) a browser's subscription. `origin` is the site's address, which identifies
 * this server to the push service; Apple requires an https URL or a mailto: address.
 */
export function savePushSubscription(input: unknown, userAgent: string, origin: string) {
	const sub = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
	const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
	const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
	const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : '';
	if (
		!validEndpoint(endpoint) ||
		!/^[\w-]{80,100}=*$/.test(p256dh) ||
		!/^[\w-]{20,30}=*$/.test(auth)
	) {
		return false;
	}
	// Apple rejects a subject it can't parse as an address, such as mailto:…@localhost, so a
	// development server over plain http falls back to a placeholder.
	const email = getSettings().contactEmail;
	const subject = origin.startsWith('https:')
		? origin
		: email
			? `mailto:${email}`
			: 'mailto:admin@example.com';
	run(
		`INSERT INTO push_subscriptions (endpoint, p256dh, auth, name, subject) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth,
			name = excluded.name, subject = excluded.subject`,
		endpoint,
		p256dh,
		auth,
		deviceName(userAgent),
		subject
	);
	return true;
}

export function removePushSubscription(by: { id: number } | { endpoint: string }) {
	if ('id' in by) run('DELETE FROM push_subscriptions WHERE id = ?', by.id);
	else run('DELETE FROM push_subscriptions WHERE endpoint = ?', by.endpoint);
}

async function sendOne(
	sub: PushSubscriptionKeys & { id: number; subject: string },
	payload: Buffer
): Promise<boolean> {
	try {
		const response = await fetch(sub.endpoint, {
			method: 'POST',
			headers: {
				authorization: vapidAuthorization(sub.endpoint, vapidKeys(), sub.subject),
				'content-encoding': 'aes128gcm',
				'content-type': 'application/octet-stream',
				ttl: String(24 * 60 * 60),
				urgency: 'normal'
			},
			body: new Uint8Array(encryptPayload(payload, sub)),
			signal: AbortSignal.timeout(10_000)
		});
		// Gone: the browser unsubscribed, or the app was removed from the Home Screen.
		if (response.status === 404 || response.status === 410) {
			removePushSubscription({ id: sub.id });
			return false;
		}
		if (!response.ok) {
			const detail = (await response.text().catch(() => '')).slice(0, 200);
			console.warn(
				`[gallery] Push to ${new URL(sub.endpoint).host} failed:`,
				response.status,
				detail
			);
			return false;
		}
		return true;
	} catch (error) {
		console.warn('[gallery] Push notification failed:', (error as Error).message);
		return false;
	}
}

/** Sends to every subscribed device and returns how many accepted it. */
export async function sendPush(message: PushMessage): Promise<number> {
	const subs = all<PushSubscriptionKeys & { id: number; subject: string }>(
		'SELECT id, endpoint, p256dh, auth, subject FROM push_subscriptions'
	);
	if (!subs.length) return 0;
	const payload = Buffer.from(
		JSON.stringify({
			title: message.title.slice(0, 120),
			body: message.body?.slice(0, 1000),
			url: message.url,
			tag: message.tag
		})
	);
	const results = await Promise.all(subs.map((sub) => sendOne(sub, payload)));
	return results.filter(Boolean).length;
}
