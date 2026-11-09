import { error, fail } from '@sveltejs/kit';
import { listBillingAddresses } from '#lib/server/billing.js';
import { parseBookingForm } from '#lib/server/booking-form.js';
import {
	albumOptions,
	clientSuggestions,
	getBooking,
	updateBooking
} from '#lib/server/bookings.js';
import { requireAdmin } from '#lib/server/guard.js';
import { listInvoices } from '#lib/server/invoices.js';
import type { Actions, PageServerLoad } from './$types';

function requireBooking(id: string) {
	const booking = getBooking(Number(id));
	if (!booking) error(404, 'Job not found');
	return booking;
}

export const load: PageServerLoad = ({ params, locals, depends }) => {
	requireAdmin(locals);
	depends('admin:booking');
	const booking = requireBooking(params.id);
	return {
		booking,
		addresses: listBillingAddresses(),
		clients: clientSuggestions(),
		albums: albumOptions(),
		invoices: listInvoices().map(({ id, number, billToName, total }) => ({
			id,
			number,
			billToName,
			total
		})),
		initial: {
			title: booking.title,
			client: booking.client,
			billingAddressId: booking.billingAddressId,
			location: booking.location,
			date: booking.startsAt?.slice(0, 10) ?? '',
			time: booking.startsAt?.slice(11, 16) ?? '',
			endTime: booking.endsAt?.slice(11, 16) ?? '',
			status: booking.status,
			shot: booking.shot,
			delivered: booking.delivered,
			notes: booking.notes
		}
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		requireAdmin(locals);
		const booking = requireBooking(params.id);
		const result = parseBookingForm(await request.formData());
		if (!result.ok) return fail(400, { error: result.error, field: result.field ?? null });
		updateBooking(booking.id, result.input);
		return { saved: true };
	}
};
