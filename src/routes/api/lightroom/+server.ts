import { version } from '$app/env';
import { requireToken } from '#lib/server/lightroom.js';
import { getSettings } from '#lib/server/settings.js';
import type { RequestHandler } from './$types';

/** “Test Connection” in the plugin: checks the token and names the site. */
export const GET: RequestHandler = (event) => {
	requireToken(event);
	return Response.json({ site: getSettings().siteTitle, version, api: 1 });
};
