import { fail, redirect } from '@sveltejs/kit';
import { checkAdminCredentials, createAdminSession } from '#lib/server/auth.js';
import { hasPasskeys } from '#lib/server/passkeys.js';
import { clientIp, rateLimit } from '#lib/server/ratelimit.js';
import type { Actions, PageServerLoad } from './$types';

function safeNext(value: string | null) {
	return value && value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin';
}

export const load: PageServerLoad = ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (locals.isAdmin) redirect(303, next);
	return { passkeys: hasPasskeys(), next };
};

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies, url } = event;

		// Checked before the body is read, so rate-limited clients can't make the server parse it.
		if (!rateLimit(`login:${clientIp(event)}`, 8, 15 * 60 * 1000)) {
			return fail(429, {
				username: '',
				error: 'Too many sign-in attempts. Please wait a few minutes and try again.'
			});
		}

		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		if (!username || !password || !checkAdminCredentials(username, password)) {
			return fail(400, { username, error: 'The username or password is incorrect.' });
		}

		createAdminSession({ cookies, url });
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
