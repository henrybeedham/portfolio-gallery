import { error } from '@sveltejs/kit';
import { getAlbumById } from './albums.js';

export function requireAdmin(locals: App.Locals) {
	if (!locals.isAdmin) error(401, 'Please sign in');
}

export function requireAlbum(id: string | undefined) {
	const album = getAlbumById(Number(id));
	if (!album) error(404, 'Album not found');
	return album;
}
