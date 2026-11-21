import crypto from 'node:crypto';
import { all, get, run, transaction } from './db.js';
import { billingAddressText, getBillingAddress, getInvoiceSettings } from './billing.js';
import { getBooking, invoiceState } from './bookings.js';
import { getTheme, hasTheme } from './themes.js';
import { itemsTotal } from '#lib/money.js';
import type {
	Booking,
	InvoiceDocument,
	InvoiceItem,
	InvoiceSender,
	InvoiceSummary,
	JobRef
} from '#lib/types.js';
import { invoiceDueDate, isIsoDay, jobHours, lastShootDay, todayIso } from '#lib/utils.js';

export interface Invoice extends InvoiceDocument {
	id: number;
	bookingIds: number[];
	billingAddressId: number | null;
	/** Not sent yet: it holds the expected fee and is dated when it's issued. */
	draft: boolean;
	/** Sent from another platform, or converted from a job's old fee or paid tick; there's no PDF. */
	imported: boolean;
	total: number;
	createdAt: string;
	updatedAt: string;
}

export type InvoiceInput = Omit<Invoice, 'id' | 'total' | 'createdAt' | 'updatedAt'>;

interface InvoiceRow {
	id: number;
	number: string;
	billing_address_id: number | null;
	issue_date: string;
	due_date: string | null;
	bill_to_name: string;
	bill_to_address: string;
	sender: string;
	payment_details: string;
	notes: string;
	items: string;
	total: number;
	style: string;
	paid_at: string | null;
	draft: number;
	imported: number;
	created_at: string;
	updated_at: string;
}

function parseJson<T>(value: string, fallback: T): T {
	try {
		return JSON.parse(value) ?? fallback;
	} catch {
		return fallback;
	}
}

function invoiceJobIds(invoiceId: number) {
	return all<{ booking_id: number }>(
		'SELECT booking_id FROM invoice_bookings WHERE invoice_id = ? ORDER BY booking_id',
		invoiceId
	).map((row) => row.booking_id);
}

function setInvoiceJobs(invoiceId: number, bookingIds: number[]) {
	run('DELETE FROM invoice_bookings WHERE invoice_id = ?', invoiceId);
	for (const bookingId of bookingIds) {
		run(
			'INSERT OR IGNORE INTO invoice_bookings (invoice_id, booking_id) VALUES (?, ?)',
			invoiceId,
			bookingId
		);
	}
}

function mapInvoice(row: InvoiceRow): Invoice {
	return {
		id: row.id,
		number: row.number,
		bookingIds: invoiceJobIds(row.id),
		billingAddressId: row.billing_address_id,
		issueDate: row.issue_date,
		dueDate: row.due_date,
		billToName: row.bill_to_name,
		billToAddress: row.bill_to_address,
		sender: { name: '', address: '', phone: '', email: '', ...parseJson(row.sender, {}) },
		paymentDetails: row.payment_details,
		notes: row.notes,
		items: parseJson<InvoiceItem[]>(row.items, []),
		total: row.total,
		style: row.style,
		paidAt: row.paid_at,
		draft: !!row.draft,
		imported: !!row.imported,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** Checks invoices made here and the numbers on imported records (which can list several). */
export function isInvoiceNumberTaken(number: string): boolean {
	if (get('SELECT 1 FROM invoices WHERE number = ?', number)) return true;
	return all<{ number: string }>(
		"SELECT number FROM invoices WHERE imported = 1 AND number LIKE '%,%'"
	).some((row) => row.number.split(/,\s*/).includes(number));
}

/** A random 8-digit number (never starting with 0) that no invoice, old or new, has used. */
export function generateInvoiceNumber(): string {
	for (let attempt = 0; attempt < 1000; attempt++) {
		const number = String(crypto.randomInt(10_000_000, 100_000_000));
		if (!isInvoiceNumberTaken(number)) return number;
	}
	throw new Error('Could not find an unused invoice number.');
}

export function listInvoices(): InvoiceSummary[] {
	const today = todayIso();
	const jobs = new Map<number, JobRef[]>();
	for (const link of all<JobRef & { invoice_id: number }>(
		`SELECT l.invoice_id, b.id, b.title
		 FROM invoice_bookings l JOIN bookings b ON b.id = l.booking_id
		 ORDER BY b.starts_at, b.id`
	)) {
		const job = { id: link.id, title: link.title };
		jobs.set(link.invoice_id, [...(jobs.get(link.invoice_id) ?? []), job]);
	}
	return all<{
		id: number;
		number: string;
		bill_to_name: string;
		issue_date: string;
		due_date: string | null;
		total: number;
		paid_at: string | null;
		draft: number;
		imported: number;
		style: string;
	}>(
		`SELECT id, number, bill_to_name, issue_date, due_date, total, paid_at, draft, imported, style
		 FROM invoices ORDER BY draft DESC, issue_date DESC, id DESC`
	).map((row) => ({
		id: row.id,
		number: row.number,
		jobs: jobs.get(row.id) ?? [],
		billToName: row.bill_to_name,
		issueDate: row.issue_date,
		dueDate: row.due_date,
		total: row.total,
		paidAt: row.paid_at,
		state: invoiceState({ draft: !!row.draft, paidAt: row.paid_at, dueDate: row.due_date }, today),
		imported: !!row.imported,
		style: row.style
	}));
}

export function getInvoice(id: number): Invoice | undefined {
	const row = get<InvoiceRow>('SELECT * FROM invoices WHERE id = ?', id);
	return row && mapInvoice(row);
}

export function createInvoice(input: InvoiceInput): number {
	return transaction(() => {
		const id = run(
			`INSERT INTO invoices (number, billing_address_id, issue_date, due_date, bill_to_name,
				bill_to_address, sender, payment_details, notes, items, total, style, paid_at, draft, imported)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			input.number,
			input.billingAddressId,
			input.issueDate,
			input.dueDate,
			input.billToName,
			input.billToAddress,
			JSON.stringify(input.sender),
			input.paymentDetails,
			input.notes,
			JSON.stringify(input.items),
			itemsTotal(input.items),
			input.style,
			input.draft ? null : input.paidAt,
			input.draft,
			input.imported
		).lastInsertRowid;
		setInvoiceJobs(id, input.bookingIds);
		return id;
	});
}

/**
 * The number, draft and imported flags never change here; issuing a draft is `issueInvoice`.
 * A draft can't be paid until it's issued.
 */
export function updateInvoice(id: number, input: InvoiceInput) {
	transaction(() => {
		run(
			`UPDATE invoices SET billing_address_id = ?, issue_date = ?, due_date = ?, bill_to_name = ?,
				bill_to_address = ?, sender = ?, payment_details = ?, notes = ?, items = ?, total = ?, style = ?,
				paid_at = CASE WHEN draft = 1 THEN NULL ELSE ? END,
				updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			 WHERE id = ?`,
			input.billingAddressId,
			input.issueDate,
			input.dueDate,
			input.billToName,
			input.billToAddress,
			JSON.stringify(input.sender),
			input.paymentDetails,
			input.notes,
			JSON.stringify(input.items),
			itemsTotal(input.items),
			input.style,
			input.paidAt,
			id
		);
		setInvoiceJobs(id, input.bookingIds);
	});
}

function invoiceBookings(ids: number[]): Booking[] {
	return ids.map(getBooking).filter((booking) => !!booking);
}

/**
 * Sends a draft: it's dated today and due by your usual rule (the shoot date if it's still ahead,
 * otherwise after your payment terms), as a new invoice would be.
 */
export function issueInvoice(invoice: Invoice): { issueDate: string; dueDate: string } {
	const issueDate = todayIso();
	const dueDate = invoiceDueDate(
		issueDate,
		lastShootDay(invoiceBookings(invoice.bookingIds)),
		getInvoiceSettings()
	);
	run(
		`UPDATE invoices SET draft = 0, issue_date = ?, due_date = ?,
			updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		 WHERE id = ?`,
		issueDate,
		dueDate,
		invoice.id
	);
	return { issueDate, dueDate };
}

export function setInvoicePaid(id: number, paidAt: string | null) {
	run(
		`UPDATE invoices SET paid_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
		paidAt,
		id
	);
}

export function deleteInvoice(id: number) {
	run('DELETE FROM invoices WHERE id = ?', id);
}

/**
 * Records an invoice sent from another platform as an imported record. A draft on the job becomes
 * that record, so its fee isn't counted twice. A blank amount keeps the draft's fee. Returns an
 * error message if the details aren't usable.
 */
export function recordExternalInvoice(
	booking: Booking,
	raw: Record<string, unknown>
): string | null {
	const issueDate = day(raw.date);
	if (!issueDate) return 'Please set the date you invoiced.';
	const amount = raw.amount == null ? null : Number(raw.amount);
	if (amount !== null && (!Number.isInteger(amount) || amount < 0 || amount > 100_000_000)) {
		return 'Check the amount.';
	}
	const number = text(raw.number, 40);
	const paidAt = day(raw.paidAt);
	const settings = getInvoiceSettings();
	const fee = [{ description: settings.itemDescription, quantity: 1, rate: amount ?? 0 }];

	const ref = booking.invoices.find((invoice) => invoice.state === 'draft');
	const draft = ref && getInvoice(ref.id);
	if (draft) {
		const items = amount === null || amount === draft.total ? draft.items : fee;
		run(
			`UPDATE invoices SET number = ?, issue_date = ?, due_date = NULL, items = ?, total = ?, paid_at = ?,
				draft = 0, imported = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			 WHERE id = ?`,
			number,
			issueDate,
			JSON.stringify(items),
			itemsTotal(items),
			paidAt,
			draft.id
		);
		return null;
	}

	const address = getBillingAddress(booking.billingAddressId);
	createInvoice({
		number,
		bookingIds: [booking.id],
		billingAddressId: address?.id ?? null,
		issueDate,
		dueDate: null,
		billToName: booking.client || booking.title,
		billToAddress: address ? billingAddressText(address) : '',
		sender: { name: '', address: '', phone: '', email: '' },
		paymentDetails: '',
		notes: '',
		items: fee,
		style: settings.style,
		paidAt,
		draft: false,
		imported: true
	});
	return null;
}

/** A new invoice filled in from your invoice settings and, optionally, its jobs. */
export function newInvoice(bookings: Booking[] = []): InvoiceInput {
	const settings = getInvoiceSettings();
	const issueDate = todayIso();
	const dueDate = invoiceDueDate(issueDate, lastShootDay(bookings), settings);
	const booking = bookings[0];
	const address = getBillingAddress(booking?.billingAddressId);
	const hours = bookings.reduce((sum, job) => sum + (jobHours(job.startsAt, job.endsAt) ?? 0), 0);

	return {
		number: generateInvoiceNumber(),
		bookingIds: bookings.map((job) => job.id),
		billingAddressId: address?.id ?? null,
		issueDate,
		dueDate,
		billToName: booking ? booking.client || booking.title : '',
		billToAddress: address ? billingAddressText(address) : '',
		sender: { ...settings.sender },
		paymentDetails: settings.paymentDetails,
		notes: settings.notes,
		items: [
			{
				description: settings.itemDescription,
				quantity: Math.round(hours * 100) / 100 || 1,
				rate: settings.hourlyRate
			}
		],
		style: getTheme(settings.style).id,
		paidAt: null,
		draft: false,
		imported: false
	};
}

/* ------------------------------------------------------------------ parsing */

function text(value: unknown, max: number) {
	return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
}

function day(value: unknown): string | null {
	const s = text(value, 10);
	return isIsoDay(s) ? s : null;
}

function id(value: unknown): number | null {
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : null;
}

type InvoiceParseResult = { ok: true; input: InvoiceInput } | { ok: false; error: string };

/** Validates an invoice sent by the editor (as JSON). `draft` only matters when creating one. */
export function parseInvoice(raw: unknown): InvoiceParseResult {
	if (!raw || typeof raw !== 'object') return { ok: false, error: 'Missing invoice details.' };
	const body = raw as Record<string, unknown>;

	const issueDate = day(body.issueDate);
	if (!issueDate) return { ok: false, error: 'Please set the invoice date.' };
	const dueDate = day(body.dueDate);

	const rawItems = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
	const items: InvoiceItem[] = [];
	for (const entry of rawItems) {
		if (!entry || typeof entry !== 'object') continue;
		const item = entry as Record<string, unknown>;
		const description = text(item.description, 300);
		const quantity = Number(item.quantity);
		const rate = Number(item.rate);
		if (!description && !quantity && !rate) continue;
		if (!Number.isFinite(quantity) || Math.abs(quantity) > 100_000)
			return { ok: false, error: `Check the quantity for “${description || 'an item'}”.` };
		if (!Number.isInteger(rate) || Math.abs(rate) > 100_000_000)
			return { ok: false, error: `Check the rate for “${description || 'an item'}”.` };
		items.push({ description, quantity: Math.round(quantity * 1000) / 1000, rate });
	}
	if (!items.length) return { ok: false, error: 'Add at least one line item.' };

	const senderRaw = (body.sender && typeof body.sender === 'object' ? body.sender : {}) as Record<
		string,
		unknown
	>;
	const sender: InvoiceSender = {
		name: text(senderRaw.name, 200),
		address: text(senderRaw.address, 1000),
		phone: text(senderRaw.phone, 60),
		email: text(senderRaw.email, 200)
	};

	const bookingIds = (Array.isArray(body.bookingIds) ? body.bookingIds.slice(0, 50) : [])
		.map(id)
		.filter((value) => value !== null && !!getBooking(value)) as number[];
	const billingAddressId = id(body.billingAddressId);
	const style = text(body.style, 40);

	return {
		ok: true,
		input: {
			number: text(body.number, 20),
			bookingIds: [...new Set(bookingIds)].sort((a, b) => a - b),
			billingAddressId:
				billingAddressId && getBillingAddress(billingAddressId) ? billingAddressId : null,
			issueDate,
			dueDate,
			billToName: text(body.billToName, 200),
			billToAddress: text(body.billToAddress, 1000),
			sender,
			paymentDetails: text(body.paymentDetails, 2000),
			notes: text(body.notes, 4000),
			items,
			style: hasTheme(style) ? style : getTheme(getInvoiceSettings().style).id,
			paidAt: day(body.paidAt),
			draft: body.draft === true,
			imported: false
		}
	};
}

/** “Invoice 25778884.pdf”, matching the file names you've used before. */
export function invoiceFilename(number: string) {
	return `Invoice ${number.replace(/[^\w-]/g, '')}.pdf`;
}
