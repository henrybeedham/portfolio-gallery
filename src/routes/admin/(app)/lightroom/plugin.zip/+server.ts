import { requireAdmin } from '#lib/server/guard.js';
import { pluginZip } from '#lib/server/lightroom-plugin.js';
import { getSettings } from '#lib/server/settings.js';
import { contentDisposition } from '#lib/server/zip.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals, url }) => {
	requireAdmin(locals);
	return new Response(pluginZip(url.origin, getSettings().siteTitle), {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': contentDisposition('GalleryPublisher.lrplugin.zip'),
			'cache-control': 'no-store'
		}
	});
};
