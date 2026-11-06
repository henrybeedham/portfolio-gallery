import { redirect } from '@sveltejs/kit';
import { destroyAdminSession } from '#lib/server/auth.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies, url }) => {
	destroyAdminSession({ cookies, url });
	redirect(303, '/admin/login');
};
