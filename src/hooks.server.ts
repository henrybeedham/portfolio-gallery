import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { isAdminSession } from '#lib/server/auth.js';
import { adminCredentials } from '#lib/server/config.js';
import { getDb } from '#lib/server/db.js';
import { getSettings } from '#lib/server/settings.js';
import { getTheme, themeCss, themeVersion } from '#lib/server/themes.js';

export const init: ServerInit = () => {
	getDb();
	adminCredentials();
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const COMPRESSIBLE = /^(?:text\/html|application\/json)\b/;

/** Gzips pages and JSON. Static assets are precompressed at build time; images and ZIPs don't shrink. */
function gzip(request: Request, response: Response) {
	if (
		!response.body ||
		response.headers.has('content-encoding') ||
		!COMPRESSIBLE.test(response.headers.get('content-type') ?? '') ||
		!/\bgzip\b/.test(request.headers.get('accept-encoding') ?? '')
	) {
		return response;
	}
	const headers = new Headers(response.headers);
	headers.set('content-encoding', 'gzip');
	headers.delete('content-length');
	headers.append('vary', 'Accept-Encoding');
	return new Response(response.body.pipeThrough(new CompressionStream('gzip')), {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

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

	const response = await resolve(event, {
		// Runs after the page's load functions, so an album page's theme (see albumPageTheme) is set.
		transformPageChunk: ({ html }) =>
			html
				.replace('%gallery.theme%', () => event.locals.theme ?? getTheme(getSettings().theme).id)
				.replace('%gallery.themesVersion%', themeVersion)
				.replace('%gallery.themes%', themeCss)
	});

	response.headers.set('x-frame-options', 'SAMEORIGIN');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	if (event.url.protocol === 'https:') {
		response.headers.set('strict-transport-security', 'max-age=31536000');
	}
	return gzip(event.request, response);
};
