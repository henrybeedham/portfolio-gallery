/**
 * A job counts as delivered once a gallery linked to it is visible (public) and has something in
 * it. This only ever ticks “Delivered”; it never unticks it, so you can still set it by hand.
 */
import { run } from './db.js';

const DELIVERABLE = `
	SELECT ba.booking_id FROM booking_albums ba JOIN albums a ON a.id = ba.album_id
	WHERE a.is_public = 1 AND EXISTS (SELECT 1 FROM photos p WHERE p.album_id = a.id)`;

/** Call after an album is linked, saved or given photos. */
export function deliverJobsForAlbum(albumId: number) {
	run(
		`UPDATE bookings SET delivered = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		 WHERE delivered = 0 AND status != 'cancelled'
			AND id IN (${DELIVERABLE} AND a.id = ?)`,
		albumId
	);
}
