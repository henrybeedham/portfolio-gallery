import { error } from '@sveltejs/kit';
import { createBackup, deleteBackup, restoreBackup } from '#lib/server/backups.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	const body = await request.json().catch(() => null);
	const name = typeof body?.name === 'string' ? body.name : '';
	switch (body?.action) {
		case 'create':
			return Response.json({ name: createBackup() });
		case 'restore': {
			const problem = restoreBackup(name);
			if (problem) error(400, problem);
			return Response.json({ ok: true });
		}
		case 'delete':
			if (!deleteBackup(name)) error(404, 'That backup no longer exists.');
			return Response.json({ ok: true });
		default:
			error(400, 'Unknown action');
	}
};
