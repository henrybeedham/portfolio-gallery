/** Browser side of push notifications: the service worker and this device's subscription. */
import { dev } from '$app/env';

export type PushSupport = 'supported' | 'needs-install' | 'unsupported';

function isIos() {
	return (
		/iPhone|iPad|iPod/.test(navigator.userAgent) ||
		// iPadOS reports itself as a Mac.
		(navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
	);
}

function isStandalone() {
	return (
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

/** Whether this browser can subscribe, or (on iPhone and iPad) has to be opened from the Home Screen first. */
export function pushSupport(): PushSupport {
	const capable =
		'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
	if (capable) return 'supported';
	if (isIos() && !isStandalone()) return 'needs-install';
	return 'unsupported';
}

/** Registers the service worker (it's idempotent) and waits until it's ready. */
export async function registerServiceWorker() {
	if (!('serviceWorker' in navigator)) return null;
	await navigator.serviceWorker.register('/service-worker.js', {
		type: dev ? 'module' : 'classic'
	});
	return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
	const registration = await registerServiceWorker();
	return (await registration?.pushManager.getSubscription()) ?? null;
}

function keyBytes(base64url: string) {
	const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array) {
	if (!a) return false;
	const bytes = new Uint8Array(a);
	return bytes.length === b.length && bytes.every((value, i) => value === b[i]);
}

/**
 * Asks for permission and subscribes this browser. Call it straight from a tap: iOS only shows the
 * permission prompt in response to one.
 */
export async function subscribe(publicKey: string): Promise<PushSubscription> {
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') {
		throw new Error(
			permission === 'denied'
				? 'Notifications are blocked for this site. Allow them in the device’s settings.'
				: 'Notifications weren’t allowed.'
		);
	}
	const registration = await registerServiceWorker();
	if (!registration) throw new Error('This browser can’t receive notifications.');
	const key = keyBytes(publicKey);
	const existing = await registration.pushManager.getSubscription();
	// A subscription made for a different server key (say, after DATA_DIR was reset) can't be used.
	if (existing && sameKey(existing.options.applicationServerKey, key)) return existing;
	await existing?.unsubscribe();
	return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}
