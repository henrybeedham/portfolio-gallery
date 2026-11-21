/**
 * Jobs used to hold money themselves: hours × rate, a “paid” tick and the numbers of invoices sent
 * before this system. Money now lives on invoices only, so this turns those fields into invoices.
 * Only the migration that removed the fields uses it.
 */
import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { mergeInvoiceSettings } from './invoice-defaults.js';
import type { InvoiceInput } from './invoices.js';
import { formatHours, formatMoney, itemsTotal } from '#lib/money.js';
import type { BookingStatus, InvoiceSettings } from '#lib/types.js';
import { invoiceDueDate, todayIso } from '#lib/utils.js';

/** Cleans up a list of invoice numbers: “1, 2 3” → “1, 2, 3”. */
function cleanInvoiceNumbers(value: string) {
	return value
		.split(/[,;\s]+/)
		.map((part) => part.trim())
		.filter((part) => /^[\w-]{1,20}$/.test(part))
		.join(', ');
}

interface LegacyMoney {
	bookingId: number;
	title: string;
	client: string;
	billingAddressId: number | null;
	billToAddress: string;
	status: BookingStatus;
	startsAt: string | null;
	hours: number;
	/** Pence per hour. */
	rate: number;
	paid: boolean;
	/** Earlier invoice numbers, comma separated. */
	legacyInvoices: string;
}

interface LegacyContext {
	settings: InvoiceSettings;
	today: string;
	/** An unused invoice number, for drafts. */
	newNumber: () => string;
	/** The job already has invoices here, and they have always decided its money. */
	hasInvoices?: boolean;
}

/**
 * - Paid, or sent on an earlier invoice: an imported record, with the earlier numbers and no PDF.
 * - A fee that was never invoiced: a draft, so it still counts as booked (or tentative).
 * - A cancelled job's fee, or earlier numbers on a job that already has invoices: a line in its notes.
 */
function convertLegacyMoney(
	job: LegacyMoney,
	ctx: LegacyContext
): { invoice: InvoiceInput } | { note: string } | null {
	const numbers = cleanInvoiceNumbers(job.legacyInvoices);
	if (ctx.hasInvoices) return numbers ? { note: `Earlier invoice numbers: ${numbers}` } : null;

	const hours = Math.max(0, Math.round(job.hours * 1000) / 1000);
	const rate = Math.max(0, Math.round(job.rate));
	const fee = Math.round(hours * rate);
	const shootDay = job.startsAt?.slice(0, 10) ?? null;
	const { settings } = ctx;
	const common = {
		bookingIds: [job.bookingId],
		billingAddressId: job.billingAddressId,
		billToName: job.client || job.title,
		billToAddress: job.billToAddress,
		items: [{ description: settings.itemDescription, quantity: hours, rate }],
		style: settings.style
	};

	if (job.paid || numbers) {
		const day = shootDay ?? ctx.today;
		return {
			invoice: {
				...common,
				number: numbers,
				issueDate: day,
				dueDate: null,
				sender: { name: '', address: '', phone: '', email: '' },
				paymentDetails: '',
				notes: '',
				paidAt: job.paid ? day : null,
				draft: false,
				imported: true
			}
		};
	}
	if (!fee) return null;
	if (job.status === 'cancelled') {
		return { note: `Quoted ${formatHours(hours)} × ${formatMoney(rate)} = ${formatMoney(fee)}` };
	}
	return {
		invoice: {
			...common,
			number: ctx.newNumber(),
			issueDate: ctx.today,
			dueDate: invoiceDueDate(ctx.today, shootDay, settings),
			sender: { ...settings.sender },
			paymentDetails: settings.paymentDetails,
			notes: settings.notes,
			paidAt: null,
			draft: true,
			imported: false
		}
	};
}

/** Appends a line to a job's notes, after a blank line. */
function appendNote(notes: string, line: string) {
	return notes.trim() ? `${notes.trim()}\n\n${line}` : line;
}

interface JobRow {
	id: number;
	title: string;
	client: string;
	billing_address_id: number | null;
	organisation: string | null;
	address: string | null;
	status: string;
	starts_at: string | null;
	hours: number;
	rate: number;
	paid: number;
	legacy_invoices: string;
	notes: string;
}

/**
 * The migration. Invoices gain `draft` and `imported`; the number stops being unique for imported
 * records (one earlier invoice could cover two jobs, and a paid tick has no number at all). Then
 * each job's money becomes an invoice and the old columns are dropped.
 */
export function moveJobMoneyToInvoices(db: DatabaseSync) {
	db.exec(`
		CREATE TABLE invoices_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			number TEXT NOT NULL DEFAULT '',
			booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
			billing_address_id INTEGER REFERENCES billing_addresses(id) ON DELETE SET NULL,
			issue_date TEXT NOT NULL,
			due_date TEXT,
			bill_to_name TEXT NOT NULL DEFAULT '',
			bill_to_address TEXT NOT NULL DEFAULT '',
			sender TEXT NOT NULL DEFAULT '{}',
			payment_details TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			items TEXT NOT NULL DEFAULT '[]',
			total INTEGER NOT NULL DEFAULT 0,
			style TEXT NOT NULL DEFAULT 'light',
			paid_at TEXT,
			draft INTEGER NOT NULL DEFAULT 0,
			imported INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		);
		INSERT INTO invoices_new (id, number, booking_id, billing_address_id, issue_date, due_date,
			bill_to_name, bill_to_address, sender, payment_details, notes, items, total, style, paid_at,
			created_at, updated_at)
		SELECT id, number, booking_id, billing_address_id, issue_date, due_date, bill_to_name,
			bill_to_address, sender, payment_details, notes, items, total, style, paid_at, created_at,
			updated_at
		FROM invoices;
		DROP TABLE invoices;
		ALTER TABLE invoices_new RENAME TO invoices;
		CREATE INDEX invoices_booking ON invoices(booking_id);
		CREATE UNIQUE INDEX invoices_number ON invoices(number) WHERE imported = 0;
	`);

	const settingsRow = db.prepare(`SELECT value FROM settings WHERE key = 'invoicing'`).get() as
		{ value: string } | undefined;
	const settings = mergeInvoiceSettings(settingsRow?.value);
	const today = todayIso();

	const jobs = db
		.prepare(
			`SELECT b.id, b.title, b.client, b.billing_address_id, ba.organisation, ba.address, b.status,
				b.starts_at, b.hours, b.rate, b.paid, b.legacy_invoices, b.notes
			 FROM bookings b LEFT JOIN billing_addresses ba ON ba.id = b.billing_address_id`
		)
		.all() as unknown as JobRow[];

	const taken = new Set<string>();
	for (const row of db.prepare('SELECT number FROM invoices').all() as { number: string }[]) {
		taken.add(row.number);
	}
	for (const job of jobs) {
		for (const number of cleanInvoiceNumbers(job.legacy_invoices).split(', ')) taken.add(number);
	}
	const newNumber = () => {
		for (;;) {
			const number = String(crypto.randomInt(10_000_000, 100_000_000));
			if (!taken.has(number)) {
				taken.add(number);
				return number;
			}
		}
	};
	const withInvoices = new Set(
		(
			db
				.prepare('SELECT DISTINCT booking_id AS id FROM invoices WHERE booking_id IS NOT NULL')
				.all() as { id: number }[]
		).map((row) => row.id)
	);

	const insert = db.prepare(
		`INSERT INTO invoices (number, booking_id, billing_address_id, issue_date, due_date, bill_to_name,
			bill_to_address, sender, payment_details, notes, items, total, style, paid_at, draft, imported)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	const setNotes = db.prepare('UPDATE bookings SET notes = ? WHERE id = ?');

	for (const job of jobs) {
		const result = convertLegacyMoney(
			{
				bookingId: job.id,
				title: job.title,
				client: job.client,
				billingAddressId: job.billing_address_id,
				billToAddress: [job.organisation ?? '', job.address ?? '']
					.filter((part) => part.trim())
					.join('\n'),
				status: job.status as BookingStatus,
				startsAt: job.starts_at,
				hours: job.hours,
				rate: job.rate,
				paid: !!job.paid,
				legacyInvoices: job.legacy_invoices
			},
			{ settings, today, newNumber, hasInvoices: withInvoices.has(job.id) }
		);
		if (!result) continue;
		if ('note' in result) {
			setNotes.run(appendNote(job.notes, result.note), job.id);
			continue;
		}
		const invoice = result.invoice;
		insert.run(
			invoice.number,
			invoice.bookingIds[0],
			invoice.billingAddressId,
			invoice.issueDate,
			invoice.dueDate,
			invoice.billToName,
			invoice.billToAddress,
			JSON.stringify(invoice.sender),
			invoice.paymentDetails,
			invoice.notes,
			JSON.stringify(invoice.items),
			itemsTotal(invoice.items),
			invoice.style,
			invoice.paidAt,
			invoice.draft ? 1 : 0,
			invoice.imported ? 1 : 0
		);
	}

	db.exec(`
		ALTER TABLE bookings DROP COLUMN hours;
		ALTER TABLE bookings DROP COLUMN rate;
		ALTER TABLE bookings DROP COLUMN paid;
		ALTER TABLE bookings DROP COLUMN legacy_invoices;
	`);
}
