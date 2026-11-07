/**
 * Photography jobs. They're called “jobs” in the admin; the code says “bookings” because jobs.ts
 * already means background maintenance tasks.
 */
import { all, get, placeholders, run } from './db.js';
import type {
	AlbumRef,
	Booking,
	BookingStatus,
	InvoiceRef,
	InvoiceState,
	PaymentState
} from '#lib/types.js';
import { todayIso } from '#lib/utils.js';

interface BookingRow {
	id: number;
	title: string;
	client: string;
	billing_address_id: number | null;
	billing_label: string | null;
	location: string;
	starts_at: string | null;
	hours: number;
	rate: number;
	status: string;
	shot: number;
	delivered: number;
	paid: number;
	legacy_invoices: string;
	notes: string;
}

const SELECT = `
	SELECT b.*, ba.label AS billing_label
	FROM bookings b
	LEFT JOIN billing_addresses ba ON ba.id = b.billing_address_id
`;

export function invoiceState(
	invoice: { paidAt: string | null; dueDate: string | null },
	today = todayIso()
): InvoiceState {
	if (invoice.paidAt) return 'paid';
	if (invoice.dueDate && invoice.dueDate < today) return 'overdue';
	return 'unpaid';
}

function paymentState(row: BookingRow, invoices: InvoiceRef[]): PaymentState {
	if (invoices.length) {
		const paid = invoices.filter((invoice) => invoice.state === 'paid').length;
		if (paid === invoices.length) return 'paid';
		if (paid > 0) return 'part-paid';
		return invoices.some((invoice) => invoice.state === 'overdue') ? 'overdue' : 'unpaid';
	}
	if (row.paid) return 'paid';
	return row.legacy_invoices.trim() ? 'unpaid' : 'not-invoiced';
}

/** Current local time as YYYY-MM-DDTHH:mm, comparable with starts_at. */
function nowLocal() {
	const now = new Date();
	return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function hydrate(rows: BookingRow[]): Booking[] {
	if (!rows.length) return [];
	const ids = rows.map((row) => row.id);
	const today = todayIso();
	const now = nowLocal();

	const invoices = new Map<number, InvoiceRef[]>();
	for (const invoice of all<{
		id: number;
		booking_id: number;
		number: string;
		total: number;
		paid_at: string | null;
		due_date: string | null;
	}>(
		`SELECT id, booking_id, number, total, paid_at, due_date FROM invoices
		 WHERE booking_id IN (${placeholders(ids.length)}) ORDER BY issue_date, id`,
		...ids
	)) {
		const ref: InvoiceRef = {
			id: invoice.id,
			number: invoice.number,
			total: invoice.total,
			paidAt: invoice.paid_at,
			dueDate: invoice.due_date,
			state: invoiceState({ paidAt: invoice.paid_at, dueDate: invoice.due_date }, today)
		};
		invoices.set(invoice.booking_id, [...(invoices.get(invoice.booking_id) ?? []), ref]);
	}

	const albums = new Map<number, AlbumRef[]>();
	for (const album of all<AlbumRef & { booking_id: number }>(
		`SELECT ba.booking_id, a.id, a.title, a.slug FROM booking_albums ba
		 JOIN albums a ON a.id = ba.album_id
		 WHERE ba.booking_id IN (${placeholders(ids.length)}) ORDER BY a.created_at`,
		...ids
	)) {
		const ref = { id: album.id, title: album.title, slug: album.slug };
		albums.set(album.booking_id, [...(albums.get(album.booking_id) ?? []), ref]);
	}

	return rows.map((row) => {
		const own = invoices.get(row.id) ?? [];
		const status = (['confirmed', 'tentative', 'cancelled'] as const).includes(
			row.status as BookingStatus
		)
			? (row.status as BookingStatus)
			: 'confirmed';
		return {
			id: row.id,
			title: row.title,
			client: row.client,
			billingAddressId: row.billing_address_id,
			billingLabel: row.billing_label,
			location: row.location,
			startsAt: row.starts_at,
			hours: row.hours,
			rate: row.rate,
			fee: Math.round(row.hours * row.rate),
			status,
			shot: !!row.shot,
			delivered: !!row.delivered,
			paid: !!row.paid,
			legacyInvoices: row.legacy_invoices,
			notes: row.notes,
			invoices: own,
			albums: albums.get(row.id) ?? [],
			payment: paymentState(row, own),
			upcoming: !row.starts_at || row.starts_at >= (row.starts_at.length > 10 ? now : today)
		};
	});
}

/** Upcoming jobs first (soonest first, undated last), then past jobs (most recent first). */
export function listBookings(): Booking[] {
	const bookings = hydrate(all<BookingRow>(SELECT));
	const upcoming = bookings
		.filter((booking) => booking.upcoming)
		.sort((a, b) => (a.startsAt ?? '9999').localeCompare(b.startsAt ?? '9999'));
	const past = bookings
		.filter((booking) => !booking.upcoming)
		.sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''));
	return [...upcoming, ...past];
}

export function getBooking(id: number): Booking | undefined {
	return hydrate(all<BookingRow>(`${SELECT} WHERE b.id = ?`, id))[0];
}

export function bookingsForAlbum(albumId: number): Booking[] {
	return hydrate(
		all<BookingRow>(
			`${SELECT} WHERE b.id IN (SELECT booking_id FROM booking_albums WHERE album_id = ?)`,
			albumId
		)
	);
}

export interface BookingInput {
	title: string;
	client: string;
	billingAddressId: number | null;
	location: string;
	startsAt: string | null;
	hours: number;
	rate: number;
	status: BookingStatus;
	shot: boolean;
	delivered: boolean;
	paid: boolean;
	legacyInvoices: string;
	notes: string;
}

export function createBooking(input: BookingInput): number {
	return run(
		`INSERT INTO bookings (title, client, billing_address_id, location, starts_at, hours, rate, status,
			shot, delivered, paid, legacy_invoices, notes)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.title,
		input.client,
		input.billingAddressId,
		input.location,
		input.startsAt,
		input.hours,
		input.rate,
		input.status,
		input.shot,
		input.delivered,
		input.paid,
		input.legacyInvoices,
		input.notes
	).lastInsertRowid;
}

export function updateBooking(id: number, input: BookingInput) {
	run(
		`UPDATE bookings SET title = ?, client = ?, billing_address_id = ?, location = ?, starts_at = ?, hours = ?,
			rate = ?, status = ?, shot = ?, delivered = ?, paid = ?, legacy_invoices = ?, notes = ?,
			updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		 WHERE id = ?`,
		input.title,
		input.client,
		input.billingAddressId,
		input.location,
		input.startsAt,
		input.hours,
		input.rate,
		input.status,
		input.shot,
		input.delivered,
		input.paid,
		input.legacyInvoices,
		input.notes,
		id
	);
}

export type BookingFlag = 'shot' | 'delivered' | 'paid';

export function setBookingFlag(id: number, flag: BookingFlag, value: boolean) {
	const column = { shot: 'shot', delivered: 'delivered', paid: 'paid' }[flag];
	run(
		`UPDATE bookings SET ${column} = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
		value,
		id
	);
}

/** Invoices stay, unlinked from the job. */
export function deleteBooking(id: number) {
	run('DELETE FROM bookings WHERE id = ?', id);
}

export function linkAlbum(bookingId: number, albumId: number) {
	run(
		'INSERT OR IGNORE INTO booking_albums (booking_id, album_id) VALUES (?, ?)',
		bookingId,
		albumId
	);
}

export function unlinkAlbum(bookingId: number, albumId: number) {
	run('DELETE FROM booking_albums WHERE booking_id = ? AND album_id = ?', bookingId, albumId);
}

/** Every album, newest first, for the “link an album” pickers. */
export function albumOptions(): AlbumRef[] {
	return all<AlbumRef>('SELECT id, title, slug FROM albums ORDER BY created_at DESC, id DESC');
}

/** Jobs for the invoice editor's picker, with what's needed to fill in an invoice. */
export function bookingOptions() {
	return listBookings().map((booking) => ({
		id: booking.id,
		title: booking.title,
		client: booking.client,
		billingAddressId: booking.billingAddressId,
		startsAt: booking.startsAt,
		hours: booking.hours,
		rate: booking.rate,
		status: booking.status
	}));
}

/**
 * Clients you've billed before, with the address used most recently, so typing a client's name
 * can fill in AU or Guild automatically.
 */
export function clientSuggestions(): { client: string; billingAddressId: number | null }[] {
	const rows = all<{ client: string; billing_address_id: number | null; at: string }>(
		`SELECT client, billing_address_id, updated_at AS at FROM bookings WHERE client != ''
		 UNION ALL
		 SELECT bill_to_name, billing_address_id, updated_at FROM invoices WHERE bill_to_name != ''
		 ORDER BY at DESC`
	);
	const seen = new Map<string, { client: string; billingAddressId: number | null }>();
	for (const row of rows) {
		const key = row.client.trim().toLowerCase();
		if (!seen.has(key)) {
			seen.set(key, { client: row.client.trim(), billingAddressId: row.billing_address_id });
		}
	}
	return [...seen.values()].sort((a, b) => a.client.localeCompare(b.client));
}

export function bookingStats(bookings = listBookings()) {
	const active = bookings.filter((booking) => booking.status === 'confirmed');
	const unpaidInvoices = get<{ total: number }>(
		'SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE paid_at IS NULL'
	)!.total;
	const paidInvoices = get<{ total: number }>(
		'SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE paid_at IS NOT NULL'
	)!.total;
	// Jobs with no invoice here: invoiced elsewhere (legacy numbers) or paid directly.
	const withoutInvoices = active.filter((booking) => !booking.invoices.length);
	return {
		upcoming: active.filter((booking) => booking.upcoming).length,
		toDeliver: active.filter((booking) => !booking.delivered && (booking.shot || !booking.upcoming))
			.length,
		toInvoice: active.filter((booking) => booking.payment === 'not-invoiced').length,
		outstanding:
			unpaidInvoices +
			withoutInvoices
				.filter((booking) => booking.payment === 'unpaid')
				.reduce((sum, booking) => sum + booking.fee, 0),
		paid:
			paidInvoices +
			withoutInvoices
				.filter((booking) => booking.paid)
				.reduce((sum, booking) => sum + booking.fee, 0)
	};
}

/** Every legacy invoice number, so new random numbers never repeat one. */
export function legacyInvoiceNumbers(): Set<string> {
	const numbers = new Set<string>();
	for (const row of all<{ legacy_invoices: string }>(
		"SELECT legacy_invoices FROM bookings WHERE legacy_invoices != ''"
	)) {
		for (const number of row.legacy_invoices.split(/[,\s]+/)) {
			if (number) numbers.add(number);
		}
	}
	return numbers;
}
