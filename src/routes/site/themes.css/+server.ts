import { themeCss } from '#lib/server/themes.js';
import type { RequestHandler } from './$types';

/** Every theme's CSS, for pages that were open when a theme was uploaded or deleted. */
export const GET: RequestHandler = () =>
	new Response(themeCss(), {
		headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=300' }
	});
