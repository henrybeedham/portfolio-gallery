import { error } from '@sveltejs/kit';
import { createApiToken, revokeApiToken } from '#lib/server/api-tokens.js';
import { requireAdmin } from '#lib/server/guard.js';
import { getSettings } from '#lib/server/settings.js';
import { widgetScript } from '#lib/server/widget-script.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	requireAdmin(locals);
	const body = await request.json().catch(() => null);
	switch (body?.action) {
		case 'create-token': {
			const name = String(body.name ?? '')
				.trim()
				.slice(0, 100);
			// Read-only: it can fetch the widget summary and nothing else.
			const token = createApiToken(name || 'iPhone widgets', 'widget');
			return Response.json({
				token,
				script: widgetScript(url.origin, getSettings().siteTitle, token)
			});
		}
		case 'revoke-token':
			revokeApiToken(Number(body.id), 'widget');
			return Response.json({ ok: true });
		default:
			error(400, 'Unknown action');
	}
};
