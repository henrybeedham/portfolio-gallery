import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard.js';
import { deleteCustomTheme, themeFileJson } from '#lib/server/themes.js';
import type { RequestHandler } from './$types';

/** Downloads a theme's JSON file, e.g. a built-in theme to start a new one from. */
export const GET: RequestHandler = ({ params, locals }) => {
	requireAdmin(locals);
	const json = themeFileJson(params.id);
	if (json === null) error(404, 'Theme not found');
	return new Response(json, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="${params.id}.json"`,
			'cache-control': 'no-store'
		}
	});
};

/** Deletes an uploaded theme. Built-in themes can't be deleted. */
export const DELETE: RequestHandler = ({ params, locals }) => {
	requireAdmin(locals);
	if (!deleteCustomTheme(params.id)) error(404, 'Only uploaded themes can be deleted.');
	return Response.json({ ok: true });
};
