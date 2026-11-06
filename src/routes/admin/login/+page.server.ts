import { fail, redirect } from '@sveltejs/kit';
import { checkAdminCredentials, createAdminSession } from '#lib/server/auth.js';
import { clientIp, rateLimit } from '#lib/server/ratelimit.js';
import type { Actions, PageServerLoad } from './$types';

function safeNext(value: string | null) {
	return value && value.startsWith('/admin') && !value.startsWith('//') ? value : '/admin';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.isAdmin) redirect(303, safeNext(url.searchParams.get('next')));
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies, url } = event;
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		if (!rateLimit(`login:${clientIp(event)}`, 8, 15 * 60 * 1000)) {
			return fail(429, {
				username,
				error: 'Too many sign-in attempts. Please wait a few minutes and try again.'
			});
		}

		if (!username || !password || !checkAdminCredentials(username, password)) {
			return fail(400, { username, error: 'The username or password is incorrect.' });
		}

		createAdminSession({ cookies, url });
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
