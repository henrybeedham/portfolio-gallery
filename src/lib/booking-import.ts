/**
 * Parses jobs copied from a spreadsheet (Google Sheets puts tab-separated values on the clipboard;
 * CSV files work too). Columns are matched by their header, so the order doesn't matter.
 */
import { parseMoney } from './money.js';
import type { BookingStatus } from './types.js';

export interface ImportRow {
	/** Spreadsheet line number, for messages. */
	line: number;
	title: string;
	client: string;
	billingAddressId: number | null;
	location: string;
	startsAt: string | null;
	hours: number;
	rate: number;
	status: BookingStatus;
	delivered: boolean;
	paid: boolean;
	legacyInvoices: string;
	notes: string;
}

const COLUMNS: Record<keyof Omit<ImportRow, 'line' | 'billingAddressId'>, string[]> = {
	title: ['job description', 'description', 'job', 'title', 'event', 'name'],
	// “Society” is accepted too, for older spreadsheets.
	client: ['client', 'society', 'customer'],
	location: ['location', 'venue', 'where'],
	startsAt: ['date and time', 'date & time', 'datetime', 'date', 'when', 'start'],
	hours: ['hours', 'duration', 'length'],
	rate: ['rate', 'hourly rate', 'rate per hour'],
	status: ['mine', 'status', 'confirmed'],
	delivered: ['delivered'],
	paid: ['paid'],
	legacyInvoices: [
		'invoice #',
		'invoice',
		'invoice number',
		'invoice no',
		'invoice no.',
		'invoices'
	],
	notes: ['notes', 'note', 'comments']
};

function splitCsvLine(line: string, delimiter: string): string[] {
	const cells: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (quoted) {
			if (char === '"' && line[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (char === '"') {
				quoted = false;
			} else {
				cell += char;
			}
		} else if (char === '"' && cell === '') {
			quoted = true;
		} else if (char === delimiter) {
			cells.push(cell);
			cell = '';
		} else {
			cell += char;
		}
	}
	cells.push(cell);
	return cells.map((value) => value.trim());
}

function yes(value: string) {
	return /^(y|yes|true|1|✓|✔|x|done)$/i.test(value.trim());
}

function status(value: string): BookingStatus {
	const v = value.trim().toLowerCase();
	if (/^(maybe|tentative|tbc|unconfirmed|\?)$/.test(v)) return 'tentative';
	if (/^(no|n|cancelled|canceled|false)$/.test(v)) return 'cancelled';
	return 'confirmed';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Excel/Sheets serial date (days since 30 Dec 1899) → YYYY-MM-DDTHH:mm. */
function fromSerial(serial: number): string {
	const ms = Math.round((serial - 25569) * 864e5);
	const date = new Date(ms);
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** UK-style dates: 08/12/2026 18:15:00, 8/12/26 18:15, 2026-12-08 18:15, or a serial number. */
export function parseDateTime(value: string): string | null {
	const v = value.trim();
	if (!v) return null;
	if (/^\d{5}(\.\d+)?$/.test(v)) return fromSerial(parseFloat(v));
	let match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/.exec(v);
	if (match) {
		const [, y, m, d, hh, mm] = match;
		const day = `${y}-${pad(+m)}-${pad(+d)}`;
		return hh ? `${day}T${pad(+hh)}:${mm}` : day;
	}
	match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2}))?/.exec(v);
	if (match) {
		const [, d, m, yRaw, hh, mm] = match;
		const y = yRaw.length === 2 ? 2000 + +yRaw : +yRaw;
		if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return null;
		const day = `${y}-${pad(+m)}-${pad(+d)}`;
		return hh && !(hh === '00' && mm === '00') ? `${day}T${pad(+hh)}:${mm}` : day;
	}
	return null;
}

/** “4:00:00”, “2:30”, “2.5”, “2h 30m” → hours. */
export function parseHours(value: string | number): number | null {
	if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
	const v = value.trim().toLowerCase();
	if (!v) return 0;
	let match = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(v);
	if (match) return +match[1] + +match[2] / 60 + (match[3] ? +match[3] / 3600 : 0);
	match = /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/.exec(v);
	if (match && (match[1] || match[2]))
		return (match[1] ? +match[1] : 0) + (match[2] ? +match[2] / 60 : 0);
	if (/^\d*\.?\d+$/.test(v)) return parseFloat(v);
	return null;
}

/** Spreadsheets sometimes turn long numbers into 1.6047002E7. */
function invoiceNumbers(value: string): string {
	return value
		.split(/[,;/\s]+/)
		.filter(Boolean)
		.map((part) =>
			/^\d+(\.\d+)?e\+?\d+$/i.test(part)
				? String(Math.round(Number(part)))
				: part.replace(/\.0+$/, '')
		)
		.join(', ');
}

const EVENT_WORDS = new Set([
	'ball',
	'dinner',
	'christmas',
	'xmas',
	'summer',
	'spring',
	'winter',
	'autumn',
	'careers',
	'concert',
	'social',
	'formal',
	'gala',
	'awards',
	'party',
	'day',
	'media',
	'shoot',
	'event'
]);

/** A best guess at the client from the job's title: “Boxing Christmas Dinner” → “Boxing”. */
export function guessClient(title: string): string {
	const words = title.trim().split(/\s+/);
	while (words.length > 1 && EVENT_WORDS.has(words[words.length - 1].toLowerCase())) words.pop();
	return words.length === title.trim().split(/\s+/).length ? '' : words.join(' ');
}

export interface ParseResult {
	rows: ImportRow[];
	errors: string[];
	/** Headers that were recognised, for showing what was matched. */
	matched: string[];
}

export function parseSheet(text: string): ParseResult {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	const firstLine = lines.findIndex((line) => line.trim());
	if (firstLine < 0) return { rows: [], errors: ['Paste some rows first.'], matched: [] };

	const delimiter = lines[firstLine].includes('\t') ? '\t' : ',';
	const header = splitCsvLine(lines[firstLine], delimiter).map((h) => h.toLowerCase().trim());
	const index: Partial<Record<keyof typeof COLUMNS, number>> = {};
	const matched: string[] = [];
	for (const [key, names] of Object.entries(COLUMNS) as [keyof typeof COLUMNS, string[]][]) {
		const found = header.findIndex((h) => names.includes(h));
		if (found >= 0 && !Object.values(index).includes(found)) {
			index[key] = found;
			matched.push(header[found]);
		}
	}
	if (index.title === undefined) {
		return {
			rows: [],
			errors: [
				'Couldn’t find a “Job description” column. Include the header row when you copy from the spreadsheet.'
			],
			matched
		};
	}

	const rows: ImportRow[] = [];
	const errors: string[] = [];
	for (let i = firstLine + 1; i < lines.length; i++) {
		if (!lines[i].trim()) continue;
		const cells = splitCsvLine(lines[i], delimiter);
		const cell = (key: keyof typeof COLUMNS) =>
			index[key] !== undefined ? (cells[index[key]!] ?? '') : '';
		const title = cell('title');
		if (!title) continue; // totals or blank rows

		const dateText = cell('startsAt');
		const startsAt = parseDateTime(dateText);
		if (dateText && !startsAt) errors.push(`Line ${i + 1}: couldn’t read the date “${dateText}”.`);
		const hours = parseHours(cell('hours'));
		if (hours === null) errors.push(`Line ${i + 1}: couldn’t read the hours “${cell('hours')}”.`);
		const rate = cell('rate') ? parseMoney(cell('rate')) : 0;
		if (rate === null) errors.push(`Line ${i + 1}: couldn’t read the rate “${cell('rate')}”.`);

		rows.push({
			line: i + 1,
			title: title.slice(0, 200),
			client: (cell('client') || guessClient(title)).slice(0, 200),
			billingAddressId: null,
			location: cell('location').slice(0, 200),
			startsAt,
			hours: Math.round((hours ?? 0) * 1000) / 1000,
			rate: rate ?? 0,
			status: status(cell('status')),
			delivered: yes(cell('delivered')),
			paid: yes(cell('paid')),
			legacyInvoices: invoiceNumbers(cell('legacyInvoices')),
			notes: cell('notes').slice(0, 4000)
		});
	}
	if (!rows.length && !errors.length) errors.push('No jobs found under the header row.');
	return { rows, errors, matched };
}
