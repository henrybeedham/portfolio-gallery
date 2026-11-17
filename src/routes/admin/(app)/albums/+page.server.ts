import { listAdminAlbums } from '#lib/server/albums.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends }) => {
	requireAdmin(locals);
	depends('admin:albums');
	return { albums: listAdminAlbums() };
};
