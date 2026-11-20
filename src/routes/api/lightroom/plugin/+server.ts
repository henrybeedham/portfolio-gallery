import { requireToken } from '#lib/server/lightroom.js';
import { pluginBuild, pluginZip } from '#lib/server/lightroom-plugin.js';
import { getSettings } from '#lib/server/settings.js';
import { contentDisposition } from '#lib/server/zip.js';
import type { RequestHandler } from './$types';

/** The current plugin, for the plugin's own “Install Update”. */
export const GET: RequestHandler = (event) => {
	requireToken(event);
	return new Response(pluginZip(event.url.origin, getSettings().siteTitle), {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': contentDisposition('GalleryPublisher.lrplugin.zip'),
			'cache-control': 'no-store',
			'x-plugin-build': pluginBuild
		}
	});
};
