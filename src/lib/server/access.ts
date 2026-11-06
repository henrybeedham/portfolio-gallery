import type { Cookies } from '@sveltejs/kit';
import { albumIsExpired, type Album } from './albums.js';
import { isAlbumUnlocked } from './auth.js';

export type AccessStatus = 'ok' | 'not_found' | 'locked' | 'expired';

/**
 * Decides what a visitor may see of an album.
 * Admins always get access (unless they are previewing the album as a visitor).
 */
export function albumAccess(
	album: Album,
	options: { cookies: Cookies; isAdmin: boolean; preview?: boolean }
): AccessStatus {
	const admin = options.isAdmin && !options.preview;
	if (admin) return 'ok';
	if (!album.isPublic && !options.isAdmin) return 'not_found';
	if (albumIsExpired(album)) return 'expired';
	if (album.passwordHash && !isAlbumUnlocked(options.cookies, album)) return 'locked';
	return 'ok';
}
