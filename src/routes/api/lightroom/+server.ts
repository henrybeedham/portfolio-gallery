import { version } from '$app/env';
import { requireToken } from '#lib/server/lightroom.js';
import { pluginBuild } from '#lib/server/lightroom-plugin.js';
import { getSettings } from '#lib/server/settings.js';
import type { RequestHandler } from './$types';

/** “Test Connection” in the plugin: checks the token and names the site. `plugin` is the current
 * plugin build, so the plugin can tell when there's an update. */
export const GET: RequestHandler = (event) => {
	requireToken(event);
	return Response.json({ site: getSettings().siteTitle, version, api: 1, plugin: pluginBuild });
};
