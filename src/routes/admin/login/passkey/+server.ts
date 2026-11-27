import { error } from '@sveltejs/kit';
import { createAdminSession } from '#lib/server/auth.js';
import { loginOptions, PasskeyError, verifyLogin } from '#lib/server/passkeys.js';
import { clientIp, rateLimit } from '#lib/server/ratelimit.js';
import type { RequestHandler } from './$types';

/** Signing in with a passkey: `options` starts it, `verify` checks the browser's answer. */
export const POST: RequestHandler = async (event) => {
	if (!rateLimit(`login-passkey:${clientIp(event)}`, 20, 15 * 60 * 1000)) {
		error(429, 'Too many sign-in attempts. Please wait a few minutes and try again.');
	}
	const body = await event.request.json().catch(() => null);
	switch (body?.action) {
		case 'options':
			return Response.json(loginOptions(event));
		case 'verify':
			try {
				verifyLogin(event, body.response ?? {});
			} catch (problem) {
				if (problem instanceof PasskeyError) error(400, problem.message);
				throw problem;
			}
			createAdminSession(event);
			return Response.json({ ok: true });
		default:
			error(400, 'Unknown action');
	}
};
