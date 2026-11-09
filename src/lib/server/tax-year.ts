/**
 * UK tax years run from 6 April to 5 April. A year is named by the year it starts in, so 2025 means
 * 2025–26. Invoices are counted by the date they were paid (the cash basis most sole traders use)
 * or the date they were issued. Drafts were never sent, so they're left out.
 */
import { all, get } from './db.js';
import { todayIso } from '#lib/utils.js';

export type TaxBasis = 'paid' | 'issued';
export const TAX_BASES: TaxBasis[] = ['paid', 'issued'];

export function taxYearOf(day: string): number {
	const [y, m, d] = day.split('-').map(Number);
	return m > 4 || (m === 4 && d >= 6) ? y : y - 1;
}

export function taxYearLabel(start: number) {
	return `${start}–${String(start + 1).slice(2)}`;
}

/** Every tax year with an invoice in it, newest first, always including the current one. */
export function taxYears(): number[] {
	const row = get<{ issued: string | null; paid: string | null }>(
		'SELECT MIN(issue_date) AS issued, MIN(paid_at) AS paid FROM invoices WHERE draft = 0'
	);
	const current = taxYearOf(todayIso());
	const earliest = [row?.issued, row?.paid].filter((day): day is string => !!day).sort()[0];
	const first = earliest ? Math.min(taxYearOf(earliest), current) : current;
	return Array.from({ length: current - first + 1 }, (_, i) => current - i);
}

export interface TaxYearInvoice {
	id: number;
	number: string;
	client: string;
	jobs: string;
	issueDate: string;
	dueDate: string | null;
	paidAt: string | null;
	total: number;
	imported: boolean;
}

export function taxYearInvoices(start: number, basis: TaxBasis): TaxYearInvoice[] {
	const column = basis === 'paid' ? 'i.paid_at' : 'i.issue_date';
	return all<{
		id: number;
		number: string;
		bill_to_name: string;
		jobs: string | null;
		issue_date: string;
		due_date: string | null;
		paid_at: string | null;
		total: number;
		imported: number;
	}>(
		`SELECT i.id, i.number, i.bill_to_name, i.issue_date, i.due_date, i.paid_at, i.total, i.imported,
			(SELECT group_concat(b.title, '; ') FROM invoice_bookings l JOIN bookings b ON b.id = l.booking_id
			 WHERE l.invoice_id = i.id) AS jobs
		 FROM invoices i
		 WHERE i.draft = 0 AND ${column} BETWEEN ? AND ?
		 ORDER BY ${column}, i.id`,
		`${start}-04-06`,
		`${start + 1}-04-05`
	).map((row) => ({
		id: row.id,
		number: row.number,
		client: row.bill_to_name,
		jobs: row.jobs ?? '',
		issueDate: row.issue_date,
		dueDate: row.due_date,
		paidAt: row.paid_at,
		total: row.total,
		imported: !!row.imported
	}));
}

/** A text cell. Values starting like a formula are prefixed so spreadsheets show them as text. */
function cell(value: string) {
	const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function taxYearCsv(invoices: TaxYearInvoice[]): string {
	const header = [
		'Invoice',
		'Client',
		'Jobs',
		'Date issued',
		'Date due',
		'Date paid',
		'Amount (GBP)',
		'Status',
		'Source'
	];
	const rows = invoices.map((invoice) =>
		[
			cell(invoice.number),
			cell(invoice.client),
			cell(invoice.jobs),
			invoice.issueDate,
			invoice.dueDate ?? '',
			invoice.paidAt ?? '',
			(invoice.total / 100).toFixed(2),
			invoice.paidAt ? 'Paid' : 'Unpaid',
			invoice.imported ? 'Imported or sent elsewhere' : 'Made here'
		].join(',')
	);
	// The byte order mark makes Excel read the file as UTF-8, so “£” and accents survive.
	return '﻿' + [header.join(','), ...rows].join('\r\n') + '\r\n';
}
