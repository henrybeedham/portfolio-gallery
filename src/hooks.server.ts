import { THEMES } from '#lib/types.js';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { isAdminSession } from '#lib/server/auth.js';
import { adminCredentials } from '#lib/server/config.js';
import { getDb } from '#lib/server/db.js';
import { getSettings } from '#lib/server/settings.js';

export const init: ServerInit = () => {
	getDb();
	adminCredentials();
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const handle: Handle = async ({ event, resolve }) => {
	// SvelteKit already rejects cross-site form posts. JSON and binary requests (uploads, admin API)
	// are checked here so that no state-changing request can come from another site.
	if (!SAFE_METHODS.has(event.request.method)) {
		const origin = event.request.headers.get('origin');
		if (origin) {
			let host: string | null = null;
			try {
				host = new URL(origin).host;
			} catch {
				host = null;
			}
			if (host !== event.url.host) {
				return new Response('Cross-site request blocked', { status: 403 });
			}
		}
	}

	event.locals.isAdmin = isAdminSession(event.cookies);

	const stored = getSettings().theme;
	const theme = THEMES.includes(stored) ? stored : 'light';
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%gallery.theme%', theme)
	});

	response.headers.set('x-frame-options', 'SAMEORIGIN');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	if (event.url.protocol === 'https:') {
		response.headers.set('strict-transport-security', 'max-age=31536000');
	}
	return response;
};
