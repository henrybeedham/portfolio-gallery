import { listApiTokens } from '#lib/server/api-tokens.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends, url }) => {
	requireAdmin(locals);
	depends('admin:lightroom');
	return { tokens: listApiTokens('full'), origin: url.origin };
};
