import crypto from 'node:crypto';
import { all, get, run } from './db.js';
import { billingAddressText, getBillingAddress, getInvoiceSettings } from './billing.js';
import { getBooking, invoiceState } from './bookings.js';
import { getTheme, hasTheme } from './themes.js';
import { itemsTotal } from '#lib/money.js';
import type {
	Booking,
	InvoiceDocument,
	InvoiceItem,
	InvoiceSender,
	InvoiceSummary
} from '#lib/types.js';
import { invoiceDueDate, isIsoDay, todayIso } from '#lib/utils.js';

export interface Invoice extends InvoiceDocument {
	id: number;
	bookingId: number | null;
	billingAddressId: number | null;
	/** Not sent yet: it holds the expected fee and is dated when it's issued. */
	draft: boolean;
	/** Converted from a job's old fee, paid tick or earlier invoice numbers; there's no PDF. */
	imported: boolean;
	total: number;
	createdAt: string;
	updatedAt: string;
}

export type InvoiceInput = Omit<Invoice, 'id' | 'total' | 'createdAt' | 'updatedAt'>;

interface InvoiceRow {
	id: number;
	number: string;
	booking_id: number | null;
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

function mapInvoice(row: InvoiceRow): Invoice {
	return {
		id: row.id,
		number: row.number,
		bookingId: row.booking_id,
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
	return all<{
		id: number;
		number: string;
		booking_id: number | null;
		booking_title: string | null;
		bill_to_name: string;
		issue_date: string;
		due_date: string | null;
		total: number;
		paid_at: string | null;
		draft: number;
		imported: number;
		style: string;
	}>(
		`SELECT i.id, i.number, i.booking_id, b.title AS booking_title, i.bill_to_name, i.issue_date,
			i.due_date, i.total, i.paid_at, i.draft, i.imported, i.style
		 FROM invoices i LEFT JOIN bookings b ON b.id = i.booking_id
		 ORDER BY i.draft DESC, i.issue_date DESC, i.id DESC`
	).map((row) => ({
		id: row.id,
		number: row.number,
		bookingId: row.booking_id,
		bookingTitle: row.booking_title,
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
	return run(
		`INSERT INTO invoices (number, booking_id, billing_address_id, issue_date, due_date, bill_to_name,
			bill_to_address, sender, payment_details, notes, items, total, style, paid_at, draft, imported)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.number,
		input.bookingId,
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
}

/**
 * The number, draft and imported flags never change here; issuing a draft is `issueInvoice`.
 * A draft can't be paid until it's issued.
 */
export function updateInvoice(id: number, input: InvoiceInput) {
	run(
		`UPDATE invoices SET booking_id = ?, billing_address_id = ?, issue_date = ?, due_date = ?, bill_to_name = ?,
			bill_to_address = ?, sender = ?, payment_details = ?, notes = ?, items = ?, total = ?, style = ?,
			paid_at = CASE WHEN draft = 1 THEN NULL ELSE ? END,
			updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		 WHERE id = ?`,
		input.bookingId,
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
}

/**
 * Sends a draft: it's dated today and due by your usual rule (the shoot date if it's still ahead,
 * otherwise after your payment terms), as a new invoice would be.
 */
export function issueInvoice(invoice: Invoice): { issueDate: string; dueDate: string } {
	const issueDate = todayIso();
	const shootDay = invoice.bookingId
		? getBooking(invoice.bookingId)?.startsAt?.slice(0, 10)
		: undefined;
	const dueDate = invoiceDueDate(issueDate, shootDay, getInvoiceSettings());
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

/** A new invoice filled in from your invoice settings and, optionally, a job. */
export function newInvoice(booking?: Booking): InvoiceInput {
	const settings = getInvoiceSettings();
	const issueDate = todayIso();
	const dueDate = invoiceDueDate(issueDate, booking?.startsAt?.slice(0, 10), settings);
	const address = getBillingAddress(booking?.billingAddressId);

	return {
		number: generateInvoiceNumber(),
		bookingId: booking?.id ?? null,
		billingAddressId: address?.id ?? null,
		issueDate,
		dueDate,
		billToName: booking ? booking.client || booking.title : '',
		billToAddress: address ? billingAddressText(address) : '',
		sender: { ...settings.sender },
		paymentDetails: settings.paymentDetails,
		notes: settings.notes,
		items: [{ description: settings.itemDescription, quantity: 1, rate: settings.hourlyRate }],
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

export type InvoiceParseResult = { ok: true; input: InvoiceInput } | { ok: false; error: string };

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

	const bookingId = id(body.bookingId);
	const billingAddressId = id(body.billingAddressId);
	const style = text(body.style, 40);

	return {
		ok: true,
		input: {
			number: text(body.number, 20),
			bookingId: bookingId && getBooking(bookingId) ? bookingId : null,
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
