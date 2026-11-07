import { error } from '@sveltejs/kit';
import { cleanBookingInput } from '#lib/server/booking-form.js';
import { createBooking, listBookings } from '#lib/server/bookings.js';
import { transaction } from '#lib/server/db.js';
import { requireAdmin } from '#lib/server/guard.js';
import { BOOKING_STATUSES, type BookingStatus } from '#lib/types.js';
import { isIsoDay } from '#lib/utils.js';
import type { RequestHandler } from './$types';

function startsAt(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	if (isIsoDay(value)) return value;
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && isIsoDay(value.slice(0, 10)) ? value : null;
}

/** Imports rows parsed in the browser from a pasted spreadsheet. Duplicates are skipped. */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	const body = await request.json().catch(() => null);
	if (!body || !Array.isArray(body.rows)) error(400, 'Missing rows');
	if (body.rows.length > 500) error(400, 'Import at most 500 jobs at a time');

	const existing = new Set(
		listBookings().map((booking) => `${booking.title.toLowerCase()}|${booking.startsAt?.slice(0, 10) ?? ''}`)
	);

	let imported = 0;
	let skipped = 0;
	transaction(() => {
		for (const raw of body.rows as Record<string, unknown>[]) {
			const title = typeof raw.title === 'string' ? raw.title.trim() : '';
			if (!title) continue;
			const when = startsAt(raw.startsAt);
			const key = `${title.toLowerCase()}|${when?.slice(0, 10) ?? ''}`;
			if (existing.has(key)) {
				skipped++;
				continue;
			}
			existing.add(key);
			const text = (value: unknown) => (typeof value === 'string' ? value : '');
			const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
			createBooking(
				cleanBookingInput({
					title,
					client: text(raw.client),
					billingAddressId: Number.isInteger(raw.billingAddressId) ? (raw.billingAddressId as number) : null,
					location: text(raw.location),
					startsAt: when,
					hours: number(raw.hours),
					rate: number(raw.rate),
					status: BOOKING_STATUSES.includes(raw.status as BookingStatus)
						? (raw.status as BookingStatus)
						: 'confirmed',
					shot: raw.shot === true,
					delivered: raw.delivered === true,
					paid: raw.paid === true,
					legacyInvoices: text(raw.legacyInvoices),
					notes: text(raw.notes)
				})
			);
			imported++;
		}
	});
	return Response.json({ imported, skipped });
};
