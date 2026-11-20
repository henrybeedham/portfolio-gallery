import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard.js';
import { removePushSubscription, savePushSubscription, sendPush } from '#lib/server/push.js';
import { getSettings } from '#lib/server/settings.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	requireAdmin(locals);
	const body = await request.json().catch(() => null);
	switch (body?.action) {
		case 'subscribe': {
			const userAgent = request.headers.get('user-agent') ?? '';
			if (!savePushSubscription(body.subscription, userAgent, url.origin)) {
				error(400, 'This browser’s push subscription wasn’t recognised.');
			}
			return Response.json({ ok: true });
		}
		case 'unsubscribe':
			if (typeof body.endpoint === 'string') removePushSubscription({ endpoint: body.endpoint });
			else if (typeof body.id === 'number') removePushSubscription({ id: body.id });
			else error(400, 'Nothing to remove');
			return Response.json({ ok: true });
		case 'test': {
			const sent = await sendPush({
				title: 'Test notification',
				body: `Notifications from ${getSettings().siteTitle} are working.`,
				url: `${url.origin}/admin/settings#notifications`,
				tag: 'test'
			});
			return Response.json({ sent });
		}
		default:
			error(400, 'Unknown action');
	}
};
