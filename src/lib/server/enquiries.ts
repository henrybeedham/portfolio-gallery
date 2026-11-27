import { all, get, run, transaction } from './db.js';
import { createBooking } from './bookings.js';
import { notify } from './discord.js';

export interface Enquiry {
	id: number;
	name: string;
	email: string;
	phone: string;
	/** YYYY-MM-DD, if they asked about a date. */
	eventDate: string | null;
	location: string;
	message: string;
	createdAt: string;
	read: boolean;
	archived: boolean;
	/** The job made from it, if any. */
	bookingId: number | null;
}

interface EnquiryRow {
	id: number;
	name: string;
	email: string;
	phone: string;
	event_date: string | null;
	location: string;
	message: string;
	created_at: string;
	read_at: string | null;
	archived: number;
	booking_id: number | null;
}

function mapEnquiry(row: EnquiryRow): Enquiry {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		phone: row.phone,
		eventDate: row.event_date,
		location: row.location,
		message: row.message,
		createdAt: row.created_at,
		read: !!row.read_at,
		archived: !!row.archived,
		bookingId: row.booking_id
	};
}

export const ENQUIRY_LIMITS = { name: 120, email: 200, phone: 40, location: 200, message: 5000 };

export type EnquiryInput = Pick<
	Enquiry,
	'name' | 'email' | 'phone' | 'eventDate' | 'location' | 'message'
>;

/** Checks the homepage form. Returns the cleaned input, or what's wrong and with which field. */
export function parseEnquiry(
	data: FormData
): { ok: true; input: EnquiryInput } | { ok: false; error: string; field: string } {
	const text = (name: keyof typeof ENQUIRY_LIMITS) =>
		String(data.get(name) ?? '')
			.replace(/\r\n/g, '\n')
			.trim()
			.slice(0, ENQUIRY_LIMITS[name]);
	const input: EnquiryInput = {
		name: text('name').replace(/\s+/g, ' '),
		email: text('email'),
		phone: text('phone'),
		eventDate: null,
		location: text('location').replace(/\s+/g, ' '),
		message: text('message')
	};
	const date = String(data.get('eventDate') ?? '').trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date))) input.eventDate = date;

	if (!input.name) return { ok: false, error: 'Please add your name.', field: 'name' };
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
		return { ok: false, error: 'That email address doesn’t look right.', field: 'email' };
	}
	if (input.message.length < 10) {
		return {
			ok: false,
			error: 'Please write a little about what you have in mind.',
			field: 'message'
		};
	}
	return { ok: true, input };
}

/** Saves an enquiry from the homepage and lets the photographer know. */
export function createEnquiry(input: EnquiryInput, origin: string): number {
	const id = run(
		`INSERT INTO enquiries (name, email, phone, event_date, location, message)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		input.name,
		input.email,
		input.phone,
		input.eventDate,
		input.location,
		input.message
	).lastInsertRowid;

	const details = [input.eventDate, input.location].filter(Boolean).join(' · ');
	notify({
		title: `New enquiry from ${input.name}`.slice(0, 250),
		description: `${details ? `${details}\n\n` : ''}${input.message}`.slice(0, 1000),
		url: `${origin}/admin/enquiries#enquiry-${id}`
	});
	return id;
}

export function getEnquiry(id: number): Enquiry | undefined {
	const row = get<EnquiryRow>('SELECT * FROM enquiries WHERE id = ?', id);
	return row && mapEnquiry(row);
}

export function listEnquiries(): Enquiry[] {
	return all<EnquiryRow>('SELECT * FROM enquiries ORDER BY created_at DESC, id DESC').map(
		mapEnquiry
	);
}

/** Enquiries not yet read or archived, for the sidebar's count. */
export function unreadEnquiryCount(): number {
	return get<{ n: number }>(
		'SELECT COUNT(*) AS n FROM enquiries WHERE read_at IS NULL AND archived = 0'
	)!.n;
}

export function setEnquiryRead(id: number, read: boolean) {
	run(
		`UPDATE enquiries SET read_at = ${read ? `COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` : 'NULL'}
		 WHERE id = ?`,
		id
	);
}

export function setEnquiryArchived(id: number, archived: boolean) {
	run(
		`UPDATE enquiries SET archived = ?, read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		 WHERE id = ?`,
		archived,
		id
	);
}

export function deleteEnquiry(id: number) {
	run('DELETE FROM enquiries WHERE id = ?', id);
}

/**
 * Makes a tentative job from an enquiry, with their name, date, place and message filled in, and
 * returns its id. An enquiry that already has a job returns that one.
 */
export function makeJobFromEnquiry(id: number): number | undefined {
	return transaction(() => {
		const enquiry = getEnquiry(id);
		if (!enquiry) return undefined;
		if (enquiry.bookingId && get('SELECT 1 FROM bookings WHERE id = ?', enquiry.bookingId)) {
			return enquiry.bookingId;
		}
		const contact = [enquiry.email, enquiry.phone].filter(Boolean).join(' · ');
		const bookingId = createBooking({
			title: enquiry.location ? `${enquiry.name} — ${enquiry.location}` : enquiry.name,
			client: enquiry.name,
			billingAddressId: null,
			location: enquiry.location,
			startsAt: enquiry.eventDate,
			endsAt: null,
			status: 'tentative',
			delivered: false,
			notes: `Enquiry from ${contact}\n\n${enquiry.message}`
		});
		run(
			`UPDATE enquiries SET booking_id = ?, read_at = COALESCE(read_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			 WHERE id = ?`,
			bookingId,
			id
		);
		return bookingId;
	});
}
