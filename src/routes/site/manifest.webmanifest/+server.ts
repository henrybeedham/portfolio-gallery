import { getSettings } from '#lib/server/settings.js';
import { pageTheme } from '#lib/server/themes.js';
import type { RequestHandler } from './$types';

/**
 * The web app manifest, so the admin area can be added to a phone's Home Screen and opened like an
 * app (and, on an iPhone, receive push notifications). It opens on the dashboard.
 */
export const GET: RequestHandler = () => {
	const settings = getSettings();
	const color = pageTheme(settings.theme).color;
	return new Response(
		JSON.stringify({
			id: '/admin',
			name: settings.siteTitle,
			short_name: settings.siteTitle.length > 14 ? 'Gallery' : settings.siteTitle,
			start_url: '/admin',
			scope: '/',
			display: 'standalone',
			background_color: color,
			theme_color: color,
			icons: [
				{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
				{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
				{ src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
			]
		}),
		{
			headers: {
				'content-type': 'application/manifest+json; charset=utf-8',
				'cache-control': 'public, max-age=300'
			}
		}
	);
};
