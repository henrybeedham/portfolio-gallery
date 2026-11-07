/**
 * Photography jobs. They're called “jobs” in the admin; the code says “bookings” because jobs.ts
 * already means background maintenance tasks. A job holds no money: fees and payments live on its
 * invoices, and drafts hold the fee you expect before you send anything.
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
	status: string;
	shot: number;
	delivered: number;
	notes: string;
}

const SELECT = `
	SELECT b.*, ba.label AS billing_label
	FROM bookings b
	LEFT JOIN billing_addresses ba ON ba.id = b.billing_address_id
`;

export function invoiceState(
	invoice: { draft: boolean; paidAt: string | null; dueDate: string | null },
	today = todayIso()
): InvoiceState {
	if (invoice.draft) return 'draft';
	if (invoice.paidAt) return 'paid';
	if (invoice.dueDate && invoice.dueDate < today) return 'overdue';
	return 'unpaid';
}

/** From the issued invoices; drafts only count when there's nothing else. */
function paymentState(invoices: InvoiceRef[]): PaymentState {
	const issued = invoices.filter((invoice) => invoice.state !== 'draft');
	if (issued.length) {
		const paid = issued.filter((invoice) => invoice.state === 'paid').length;
		if (paid === issued.length) return 'paid';
		if (paid > 0) return 'part-paid';
		return issued.some((invoice) => invoice.state === 'overdue') ? 'overdue' : 'unpaid';
	}
	return invoices.length ? 'draft' : 'not-invoiced';
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
		draft: number;
		imported: number;
	}>(
		`SELECT id, booking_id, number, total, paid_at, due_date, draft, imported FROM invoices
		 WHERE booking_id IN (${placeholders(ids.length)}) ORDER BY draft, issue_date, id`,
		...ids
	)) {
		const ref: InvoiceRef = {
			id: invoice.id,
			number: invoice.number,
			total: invoice.total,
			paidAt: invoice.paid_at,
			dueDate: invoice.due_date,
			state: invoiceState(
				{ draft: !!invoice.draft, paidAt: invoice.paid_at, dueDate: invoice.due_date },
				today
			),
			imported: !!invoice.imported
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
			status,
			shot: !!row.shot,
			delivered: !!row.delivered,
			notes: row.notes,
			total: own.reduce((sum, invoice) => sum + invoice.total, 0),
			invoices: own,
			albums: albums.get(row.id) ?? [],
			payment: paymentState(own),
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
	status: BookingStatus;
	shot: boolean;
	delivered: boolean;
	notes: string;
}

export function createBooking(input: BookingInput): number {
	return run(
		`INSERT INTO bookings (title, client, billing_address_id, location, starts_at, status, shot,
			delivered, notes)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.title,
		input.client,
		input.billingAddressId,
		input.location,
		input.startsAt,
		input.status,
		input.shot,
		input.delivered,
		input.notes
	).lastInsertRowid;
}

export function updateBooking(id: number, input: BookingInput) {
	run(
		`UPDATE bookings SET title = ?, client = ?, billing_address_id = ?, location = ?, starts_at = ?,
			status = ?, shot = ?, delivered = ?, notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		 WHERE id = ?`,
		input.title,
		input.client,
		input.billingAddressId,
		input.location,
		input.startsAt,
		input.status,
		input.shot,
		input.delivered,
		input.notes,
		id
	);
}

export function setBookingNotes(id: number, notes: string) {
	run(
		`UPDATE bookings SET notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
		notes,
		id
	);
}

export type BookingFlag = 'shot' | 'delivered';

export function setBookingFlag(id: number, flag: BookingFlag, value: boolean) {
	const column = { shot: 'shot', delivered: 'delivered' }[flag];
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
	const sum = (where: string) =>
		get<{ total: number }>(`SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE ${where}`)!
			.total;
	return {
		upcoming: active.filter((booking) => booking.upcoming).length,
		toDeliver: active.filter((booking) => !booking.delivered && (booking.shot || !booking.upcoming))
			.length,
		// Nothing sent yet: no invoices, or only drafts.
		toInvoice: active.filter(
			(booking) => booking.payment === 'not-invoiced' || booking.payment === 'draft'
		).length,
		outstanding: sum('draft = 0 AND paid_at IS NULL'),
		paid: sum('paid_at IS NOT NULL')
	};
}
