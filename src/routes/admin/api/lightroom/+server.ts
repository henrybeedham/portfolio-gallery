import { error } from '@sveltejs/kit';
import { createApiToken, revokeApiToken } from '#lib/server/api-tokens.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	const body = await request.json().catch(() => null);
	if (!body || typeof body.action !== 'string') error(400, 'Missing action');
	switch (body.action) {
		case 'create-token': {
			const name = String(body.name ?? '')
				.trim()
				.slice(0, 100);
			return Response.json({ token: createApiToken(name || 'Lightroom') });
		}
		case 'revoke-token': {
			revokeApiToken(Number(body.id));
			return Response.json({ ok: true });
		}
		default:
			error(400, 'Unknown action');
	}
};
