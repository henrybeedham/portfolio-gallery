import { error } from '@sveltejs/kit';
import { getAlbumById } from '#lib/server/albums.js';
import {
	deleteBooking,
	getBooking,
	linkAlbum,
	setBookingFlag,
	unlinkAlbum,
	type BookingFlag
} from '#lib/server/bookings.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { RequestHandler } from './$types';

function requireBooking(id: string) {
	const booking = getBooking(Number(id));
	if (!booking) error(404, 'Job not found');
	return booking;
}

const FLAGS: BookingFlag[] = ['shot', 'delivered', 'paid'];

export const POST: RequestHandler = async ({ request, params, locals }) => {
	requireAdmin(locals);
	const booking = requireBooking(params.id);
	const body = await request.json().catch(() => null);
	if (!body || typeof body.action !== 'string') error(400, 'Missing action');

	switch (body.action) {
		case 'set-flag': {
			if (!FLAGS.includes(body.flag)) error(400, 'Unknown flag');
			setBookingFlag(booking.id, body.flag, !!body.value);
			return Response.json({ ok: true });
		}
		case 'link-album':
		case 'unlink-album': {
			const album = getAlbumById(Number(body.albumId));
			if (!album) error(404, 'Album not found');
			if (body.action === 'link-album') linkAlbum(booking.id, album.id);
			else unlinkAlbum(booking.id, album.id);
			return Response.json({ ok: true });
		}
		default:
			error(400, 'Unknown action');
	}
};

export const DELETE: RequestHandler = ({ params, locals }) => {
	requireAdmin(locals);
	const booking = requireBooking(params.id);
	deleteBooking(booking.id);
	return Response.json({ ok: true });
};
