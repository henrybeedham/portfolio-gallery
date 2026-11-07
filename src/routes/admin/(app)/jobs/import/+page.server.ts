import { listBillingAddresses } from '#lib/server/billing.js';
import { clientSuggestions, listBookings } from '#lib/server/bookings.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals);
	return {
		addresses: listBillingAddresses(),
		clients: clientSuggestions(),
		/** title|date of every job already here, so re-importing doesn't duplicate them. */
		existing: listBookings().map(
			(booking) => `${booking.title.toLowerCase()}|${booking.startsAt?.slice(0, 10) ?? ''}`
		)
	};
};
