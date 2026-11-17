import { fail, redirect } from '@sveltejs/kit';
import { listBillingAddresses } from '#lib/server/billing.js';
import { parseBookingForm } from '#lib/server/booking-form.js';
import { clientSuggestions, createBooking } from '#lib/server/bookings.js';
import { requireAdmin } from '#lib/server/guard.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals);
	return {
		addresses: listBillingAddresses(),
		clients: clientSuggestions(),
		initial: {
			title: '',
			client: '',
			billingAddressId: null,
			location: '',
			date: '',
			time: '',
			endTime: '',
			status: 'confirmed' as const,
			delivered: false,
			notes: ''
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireAdmin(locals);
		const result = parseBookingForm(await request.formData());
		if (!result.ok) return fail(400, { error: result.error, field: result.field ?? null });
		const id = createBooking(result.input);
		redirect(303, `/admin/jobs/${id}`);
	}
};
