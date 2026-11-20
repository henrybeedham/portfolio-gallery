/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/*
 * Registered by the admin area (push-client.ts) so it can receive push notifications. It doesn't
 * cache or intercept requests: every page and image still comes straight from the server.
 */
const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('install', () => void sw.skipWaiting());
sw.addEventListener('activate', (event) => event.waitUntil(sw.clients.claim()));

sw.addEventListener('push', (event) => {
	let data: { title?: string; body?: string; url?: string; tag?: string; icon?: string } = {};
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { body: event.data?.text() };
	}
	// iOS revokes the subscription if a push arrives without a notification being shown.
	event.waitUntil(
		sw.registration.showNotification(data.title || 'Gallery', {
			body: data.body,
			tag: data.tag,
			icon: data.icon,
			data: { url: data.url ?? '/admin' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL(event.notification.data?.url ?? '/admin', sw.location.origin);
	// Only open this site's own pages.
	const url = target.origin === sw.location.origin ? target.href : `${sw.location.origin}/admin`;
	event.waitUntil(
		(async () => {
			const windows = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const open = windows[0];
			if (open) {
				await open.focus();
				await open.navigate(url).catch(() => sw.clients.openWindow(url));
			} else {
				await sw.clients.openWindow(url);
			}
		})()
	);
});
