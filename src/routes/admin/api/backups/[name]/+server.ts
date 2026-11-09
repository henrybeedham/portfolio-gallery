import { error } from '@sveltejs/kit';
import { backupPath } from '#lib/server/backups.js';
import { serveFile } from '#lib/server/files.js';
import { requireAdmin } from '#lib/server/guard.js';
import { contentDisposition } from '#lib/server/zip.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request, locals }) => {
	requireAdmin(locals);
	const file = backupPath(params.name);
	if (!file) error(404, 'Backup not found');
	const response = await serveFile(request, file, {
		type: 'application/vnd.sqlite3',
		cacheControl: 'private, no-store',
		disposition: contentDisposition(params.name)
	});
	if (!response) error(404, 'Backup not found');
	return response;
};
