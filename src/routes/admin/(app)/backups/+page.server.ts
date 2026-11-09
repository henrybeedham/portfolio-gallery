import { getStats } from '#lib/server/albums.js';
import { listBackups } from '#lib/server/backups.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends }) => {
	requireAdmin(locals);
	depends('admin:backups');
	return { backups: listBackups(), originalBytes: getStats().bytes };
};
