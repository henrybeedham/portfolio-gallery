import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard.js';
import {
	deletePasskey,
	PasskeyError,
	registerPasskey,
	registrationOptions
} from '#lib/server/passkeys.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	requireAdmin(event.locals);
	const body = await event.request.json().catch(() => null);
	const id = typeof body?.id === 'string' ? body.id : '';
	const name = typeof body?.name === 'string' ? body.name : '';
	switch (body?.action) {
		case 'options':
			return Response.json(registrationOptions(event));
		case 'register':
			try {
				return Response.json(registerPasskey(event, body.response ?? {}, name));
			} catch (problem) {
				if (problem instanceof PasskeyError) error(400, problem.message);
				throw problem;
			}
		case 'delete':
			if (!deletePasskey(id)) error(404, 'That passkey no longer exists.');
			return Response.json({ ok: true });
		default:
			error(400, 'Unknown action');
	}
};
