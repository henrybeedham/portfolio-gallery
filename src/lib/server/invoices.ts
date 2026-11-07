import crypto from 'node:crypto';
import { all, get, run } from './db.js';
import { billingAddressText, getBillingAddress, getInvoiceSettings } from './billing.js';
import { getBooking, invoiceState, legacyInvoiceNumbers } from './bookings.js';
import { getTheme, hasTheme } from './themes.js';
import { itemsTotal } from '#lib/money.js';
import type {
	Booking,
	InvoiceDocument,
	InvoiceItem,
	InvoiceSender,
	InvoiceSummary
} from '#lib/types.js';
import { addDays, isIsoDay, todayIso } from '#lib/utils.js';

export interface Invoice extends InvoiceDocument {
	id: number;
	bookingId: number | null;
	billingAddressId: number | null;
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
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function isInvoiceNumberTaken(number: string, exceptId?: number): boolean {
	const row = get<{ id: number }>('SELECT id FROM invoices WHERE number = ?', number);
	if (row && row.id !== exceptId) return true;
	return legacyInvoiceNumbers().has(number);
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
		style: string;
	}>(
		`SELECT i.id, i.number, i.booking_id, b.title AS booking_title, i.bill_to_name, i.issue_date,
			i.due_date, i.total, i.paid_at, i.style
		 FROM invoices i LEFT JOIN bookings b ON b.id = i.booking_id
		 ORDER BY i.issue_date DESC, i.id DESC`
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
		state: invoiceState({ paidAt: row.paid_at, dueDate: row.due_date }, today),
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
			bill_to_address, sender, payment_details, notes, items, total, style, paid_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
		input.paidAt
	).lastInsertRowid;
}

/** The number never changes once an invoice exists. */
export function updateInvoice(id: number, input: InvoiceInput) {
	run(
		`UPDATE invoices SET booking_id = ?, billing_address_id = ?, issue_date = ?, due_date = ?, bill_to_name = ?,
			bill_to_address = ?, sender = ?, payment_details = ?, notes = ?, items = ?, total = ?, style = ?,
			paid_at = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
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
export function draftInvoice(booking?: Booking): InvoiceInput {
	const settings = getInvoiceSettings();
	const issueDate = todayIso();
	let dueDate = addDays(issueDate, settings.paymentTermsDays);
	const shootDay = booking?.startsAt?.slice(0, 10);
	if (settings.dueOnShootDate && shootDay && shootDay >= issueDate) dueDate = shootDay;
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
		items: [
			{
				description: settings.itemDescription,
				quantity: booking?.hours || 1,
				rate: booking?.rate || settings.hourlyRate
			}
		],
		style: getTheme(settings.style).id,
		paidAt: null
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

/** Validates an invoice sent by the editor (as JSON). */
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
			paidAt: day(body.paidAt)
		}
	};
}

/** “Invoice 25778884.pdf”, matching the file names you've used before. */
export function invoiceFilename(number: string) {
	return `Invoice ${number.replace(/[^\w-]/g, '')}.pdf`;
}
