import { error } from '@sveltejs/kit';
import { iconPng, iconSvg } from '#lib/server/site-icon.js';
import { ICON_FILES, getTheme, hasTheme, themeVersion, type IconFile } from '#lib/server/themes.js';
import type { RequestHandler } from './$types';

/** A theme's icon: `favicon.svg`, or a square PNG at 180, 192 or 512 pixels (see `iconUrl`). */
export const GET: RequestHandler = async ({ params, url }) => {
	const file = params.file as IconFile;
	if (!ICON_FILES.includes(file) || !hasTheme(params.theme)) error(404, 'Not found');
	const theme = getTheme(params.theme);
	const current = url.searchParams.get('v') === themeVersion();
	const headers = {
		'content-type': file.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
		// A versioned URL never changes; anything else is checked again soon.
		'cache-control': current ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
	};
	if (file === 'favicon.svg') return new Response(iconSvg(theme, true), { headers });
	const png = await iconPng(theme, Number.parseInt(file));
	return new Response(new Uint8Array(png), { headers });
};
