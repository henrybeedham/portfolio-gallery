import { getBillingAddress } from './billing.js';
import type { BookingInput } from './bookings.js';
import { BOOKING_STATUSES, type BookingStatus } from '#lib/types.js';
import { addDays, isIsoDay } from '#lib/utils.js';

type BookingFormResult =
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

/** The end on the same day, or the next day when it's earlier than the start. */
function endsAt(date: string, time: string, endTime: string): string | null {
	if (!isIsoDay(date) || !/^\d{2}:\d{2}$/.test(time) || !/^\d{2}:\d{2}$/.test(endTime)) return null;
	return `${endTime < time ? addDays(date, 1) : date}T${endTime}`;
}

function cleanBookingInput(input: BookingInput): BookingInput {
	return {
		...input,
		title: input.title.trim().slice(0, 200),
		client: input.client.trim().slice(0, 200),
		billingAddressId:
			input.billingAddressId && getBillingAddress(input.billingAddressId)
				? input.billingAddressId
				: null,
		location: input.location.trim().slice(0, 200),
		status: BOOKING_STATUSES.includes(input.status) ? input.status : 'confirmed',
		notes: input.notes.replace(/\r\n/g, '\n').trim().slice(0, 4000)
	};
}

export function parseBookingForm(data: FormData): BookingFormResult {
	const str = (name: string) => String(data.get(name) ?? '').trim();

	const title = str('title');
	if (!title) return { ok: false, error: 'Please give the job a name.', field: 'title' };

	const date = str('date');
	if (date && !isIsoDay(date)) return { ok: false, error: 'Check the date.', field: 'date' };

	const time = str('time');
	const endTime = str('end_time');
	if (endTime && !date) {
		return { ok: false, error: 'Add a date to go with the end time.', field: 'date' };
	}
	if (endTime && !time) {
		return { ok: false, error: 'Add a start time to go with the end time.', field: 'time' };
	}
	if (endTime && endTime === time) {
		return { ok: false, error: 'The end time matches the start time.', field: 'end_time' };
	}

	const billing = Number(str('billing_address_id'));
	return {
		ok: true,
		input: cleanBookingInput({
			title,
			client: str('client'),
			billingAddressId: Number.isInteger(billing) && billing > 0 ? billing : null,
			location: str('location'),
			startsAt: startsAt(date, time),
			endsAt: endsAt(date, time, endTime),
			status: str('status') as BookingStatus,
			delivered: checkbox(data, 'delivered'),
			notes: String(data.get('notes') ?? '')
		})
	};
}
