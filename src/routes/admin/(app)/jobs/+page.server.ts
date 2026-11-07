import { bookingStats, listBookings } from '#lib/server/bookings.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends }) => {
	requireAdmin(locals);
	depends('admin:bookings');
	const bookings = listBookings();
	return { bookings, stats: bookingStats(bookings) };
};
