import { getBillingAddress } from './billing.js';
import type { BookingInput } from './bookings.js';
import { parseHours } from '#lib/booking-import.js';
import { parseMoney } from '#lib/money.js';
import { BOOKING_STATUSES, type BookingStatus } from '#lib/types.js';
import { isIsoDay } from '#lib/utils.js';

export type BookingFormResult =
	{ ok: true; input: BookingInput } | { ok: false; error: string; field?: string };

function checkbox(data: FormData, name: string) {
	const value = data.get(name);
	return value === 'on' || value === 'true' || value === '1';
}

/** Turns a date and optional time into the naive local value stored on the job. */
export function startsAt(date: string, time: string): string | null {
	if (!isIsoDay(date)) return null;
	return /^\d{2}:\d{2}$/.test(time) ? `${date}T${time}` : date;
}

/** Cleans up a list of old invoice numbers: “1, 2 3” → “1, 2, 3”. */
export function cleanLegacyInvoices(value: string) {
	return value
		.split(/[,;\s]+/)
		.map((part) => part.trim())
		.filter((part) => /^[\w-]{1,20}$/.test(part))
		.join(', ');
}

export function cleanBookingInput(input: BookingInput): BookingInput {
	return {
		...input,
		title: input.title.trim().slice(0, 200),
		client: input.client.trim().slice(0, 200),
		billingAddressId:
			input.billingAddressId && getBillingAddress(input.billingAddressId)
				? input.billingAddressId
				: null,
		location: input.location.trim().slice(0, 200),
		hours: Math.max(0, Math.min(1000, Math.round(input.hours * 1000) / 1000)),
		rate: Math.max(0, Math.min(100_000_000, Math.round(input.rate))),
		status: BOOKING_STATUSES.includes(input.status) ? input.status : 'confirmed',
		legacyInvoices: cleanLegacyInvoices(input.legacyInvoices),
		notes: input.notes.replace(/\r\n/g, '\n').trim().slice(0, 4000)
	};
}

export function parseBookingForm(data: FormData): BookingFormResult {
	const str = (name: string) => String(data.get(name) ?? '').trim();

	const title = str('title');
	if (!title) return { ok: false, error: 'Please give the job a name.', field: 'title' };

	const date = str('date');
	if (date && !isIsoDay(date)) return { ok: false, error: 'Check the date.', field: 'date' };

	const hours = parseHours(str('hours'));
	if (hours === null) return { ok: false, error: 'Enter hours like 2.5 or 2:30.', field: 'hours' };

	const rate = str('rate') ? parseMoney(str('rate')) : 0;
	if (rate === null || rate < 0)
		return { ok: false, error: 'Enter the hourly rate in pounds, e.g. 60.', field: 'rate' };

	const billing = Number(str('billing_address_id'));
	return {
		ok: true,
		input: cleanBookingInput({
			title,
			client: str('client'),
			billingAddressId: Number.isInteger(billing) && billing > 0 ? billing : null,
			location: str('location'),
			startsAt: startsAt(date, str('time')),
			hours,
			rate,
			status: str('status') as BookingStatus,
			shot: checkbox(data, 'shot'),
			delivered: checkbox(data, 'delivered'),
			paid: checkbox(data, 'paid'),
			legacyInvoices: str('legacy_invoices'),
			notes: String(data.get('notes') ?? '')
		})
	};
}
