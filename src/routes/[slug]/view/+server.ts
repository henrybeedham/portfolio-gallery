import { getAlbumBySlug } from '#lib/server/albums.js';
import { albumAccess } from '#lib/server/access.js';
import { recordView } from '#lib/server/analytics.js';
import { clientIp } from '#lib/server/ratelimit.js';
import type { RequestHandler } from './$types';

/**
 * Counts a view of the album. The page calls this once it's actually shown, so links that preload
 * the page on hover don't count. Admins are never counted.
 */
export const POST: RequestHandler = (event) => {
	const album = getAlbumBySlug(event.params.slug);
	if (
		album &&
		!event.locals.isAdmin &&
		albumAccess(album, { cookies: event.cookies, isAdmin: false }) === 'ok'
	) {
		recordView(album, clientIp(event), event.request.headers.get('user-agent'));
	}
	return new Response(null, { status: 204 });
};
