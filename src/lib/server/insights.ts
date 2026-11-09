/** Numbers for the analytics page: income, clients and gallery activity over a period. */
import { all, get } from './db.js';
import { listBookings } from './bookings.js';
import { addDays, formatShortDay, isIsoDay, todayIso } from '#lib/utils.js';

/** Preset periods. “academic” is the current academic year, “academic-prev” the one before. */
export const PRESETS = ['academic', 'academic-prev', '12m', 'year', 'all'] as const;
export type Preset = (typeof PRESETS)[number];
export type Period = Preset | 'custom';

export interface Range {
	period: Period;
	/** Inclusive YYYY-MM-DD bounds. */
	from: string;
	to: string;
	label: string;
	previous: { from: string; to: string; label: string } | null;
}

/** The pipeline money moves through, in order. Drafts are booked, or tentative for a tentative job. */
export const STAGES = ['paid', 'invoiced', 'booked', 'tentative'] as const;
export type Stage = (typeof STAGES)[number];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

function academicYear(y: number) {
	return {
		from: `${y}-09-01`,
		to: `${y + 1}-08-31`,
		label: `${y}–${String(y + 1).slice(2)}`
	};
}

interface Entry {
	day: string;
	stage: Stage;
	amount: number;
	client: string;
	billing: string;
	bookingId: number | null;
}

/**
 * Every amount of money, all of it from invoices. Dated by the job's shoot, or the invoice date for
 * invoices without a job. An invoice shared between jobs is counted as each job's share of it.
 */
function entries(): Entry[] {
	const out: Entry[] = [];
	for (const booking of listBookings()) {
		if (booking.status === 'cancelled' || !booking.startsAt) continue;
		const day = booking.startsAt.slice(0, 10);
		const base = {
			day,
			client: booking.client || booking.title,
			billing: booking.billingLabel ?? 'Other',
			bookingId: booking.id
		};
		for (const invoice of booking.invoices) {
			const stage: Stage =
				invoice.state === 'draft'
					? booking.status === 'tentative'
						? 'tentative'
						: 'booked'
					: invoice.paidAt
						? 'paid'
						: 'invoiced';
			out.push({ ...base, stage, amount: invoice.share });
		}
	}
	for (const invoice of all<{
		issue_date: string;
		total: number;
		paid_at: string | null;
		draft: number;
		bill_to_name: string;
		label: string | null;
	}>(
		`SELECT i.issue_date, i.total, i.paid_at, i.draft, i.bill_to_name, ba.label
		 FROM invoices i LEFT JOIN billing_addresses ba ON ba.id = i.billing_address_id
		 WHERE NOT EXISTS (SELECT 1 FROM invoice_bookings l WHERE l.invoice_id = i.id)`
	)) {
		out.push({
			day: invoice.issue_date,
			stage: invoice.draft ? 'booked' : invoice.paid_at ? 'paid' : 'invoiced',
			amount: invoice.total,
			client: invoice.bill_to_name || 'Unnamed',
			billing: invoice.label ?? 'Other',
			bookingId: null
		});
	}
	return out;
}

export function rangeFor(period: Preset, today = todayIso()): Range {
	const [y, m] = today.split('-').map(Number);
	const academicStart = m >= 9 ? y : y - 1;
	switch (period) {
		case 'academic':
		case 'academic-prev': {
			const start = period === 'academic' ? academicStart : academicStart - 1;
			return { period, ...academicYear(start), previous: academicYear(start - 1) };
		}
		case '12m': {
			const fromDate = new Date(Date.UTC(y, m - 12, 1));
			const from = fromDate.toISOString().slice(0, 10);
			const to = monthEnd(y, m);
			const prevFrom = new Date(Date.UTC(y, m - 24, 1)).toISOString().slice(0, 10);
			return {
				period,
				from,
				to,
				label: 'Last 12 months',
				previous: { from: prevFrom, to: addDays(from, -1), label: 'the 12 months before' }
			};
		}
		case 'year':
			return {
				period,
				from: `${y}-01-01`,
				to: `${y}-12-31`,
				label: String(y),
				previous: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: String(y - 1) }
			};
		case 'all': {
			const span = entries().map((entry) => entry.day);
			const first = span.length ? span.reduce((a, b) => (a < b ? a : b)) : today;
			const last = span.length ? span.reduce((a, b) => (a > b ? a : b)) : today;
			return {
				period,
				from: `${first.slice(0, 7)}-01`,
				to: last > today ? last : today,
				label: 'All time',
				previous: null
			};
		}
	}
}

const DAY_MS = 864e5;

/** A range between two dates (in either order), compared with the same number of days before it. */
export function customRange(from: string, to: string): Range | null {
	if (!isIsoDay(from) || !isIsoDay(to)) return null;
	if (from > to) [from, to] = [to, from];
	const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
	if (days > 366 * 20) return null;
	return {
		period: 'custom',
		from,
		to,
		label: `${formatShortDay(from)} – ${formatShortDay(to)}`,
		previous: {
			from: addDays(from, -days),
			to: addDays(from, -1),
			label: days === 1 ? 'the day before' : `the ${days} days before`
		}
	};
}

/** YYYY-MM keys from the range's first month to its last. */
function months(range: Range) {
	const keys: string[] = [];
	let [y, m] = range.from.split('-').map(Number);
	const end = range.to.slice(0, 7);
	while (`${y}-${pad(m)}` <= end && keys.length < 240) {
		keys.push(`${y}-${pad(m)}`);
		m++;
		if (m > 12) {
			m = 1;
			y++;
		}
	}
	return keys;
}

function monthLabel(key: string, first: boolean) {
	const [y, m] = key.split('-').map(Number);
	return {
		short: MONTHS[m - 1],
		long: `${MONTHS[m - 1]} ${y}`,
		// The year is shown under January and under the first month.
		year: m === 1 || first ? String(y) : ''
	};
}

function sumBy<T>(list: T[], key: (item: T) => string, value: (item: T) => number) {
	const map = new Map<string, number>();
	for (const item of list) map.set(key(item), (map.get(key(item)) ?? 0) + value(item));
	return map;
}

function moneyStats(list: Entry[]) {
	const by = (stage: Stage) =>
		list.filter((e) => e.stage === stage).reduce((sum, e) => sum + e.amount, 0);
	const confirmed = list.filter((e) => e.stage !== 'tentative');
	const jobs = new Set(confirmed.map((e) => e.bookingId).filter((id) => id !== null));
	const booked = confirmed.reduce((sum, e) => sum + e.amount, 0);
	return {
		paid: by('paid'),
		invoiced: by('invoiced'),
		uninvoiced: by('booked'),
		tentative: by('tentative'),
		booked,
		jobs: jobs.size,
		averageJob: jobs.size ? Math.round(booked / jobs.size) : 0
	};
}

function daysToPayment(range: Pick<Range, 'from' | 'to'>) {
	const row = get<{ days: number | null; n: number }>(
		`SELECT AVG(julianday(paid_at) - julianday(issue_date)) AS days, COUNT(*) AS n
		 FROM invoices WHERE paid_at IS NOT NULL AND imported = 0 AND issue_date BETWEEN ? AND ?`,
		range.from,
		range.to
	)!;
	return row.n ? Math.max(0, Math.round(row.days ?? 0)) : null;
}

/** Gallery activity per week (Monday start), from the daily log. */
function galleryActivity(range: Range) {
	const tracking = get<{ first: string | null }>(
		'SELECT MIN(day) AS first FROM album_daily_stats'
	)!;
	const rows = all<{ day: string; views: number; photos: number; albums: number }>(
		`SELECT day, SUM(views) AS views, SUM(photo_downloads) AS photos, SUM(album_downloads) AS albums
		 FROM album_daily_stats WHERE day BETWEEN ? AND ? GROUP BY day ORDER BY day`,
		range.from,
		range.to
	);
	const top = all<{ id: number; title: string; views: number; photos: number; albums: number }>(
		`SELECT a.id, a.title, SUM(s.views) AS views, SUM(s.photo_downloads) AS photos,
			SUM(s.album_downloads) AS albums
		 FROM album_daily_stats s JOIN albums a ON a.id = s.album_id
		 WHERE s.day BETWEEN ? AND ? GROUP BY a.id ORDER BY views DESC, photos DESC LIMIT 6`,
		range.from,
		range.to
	);

	const weekStart = (day: string) => {
		const date = new Date(`${day}T00:00:00Z`);
		return addDays(day, -((date.getUTCDay() + 6) % 7));
	};
	// Weeks from when tracking began (or the range start), up to this week or the range end.
	const today = todayIso();
	const startDay = tracking.first && tracking.first > range.from ? tracking.first : range.from;
	const endDay = range.to < today ? range.to : today;
	const weeks: { key: string; label: string; views: number; photos: number; albums: number }[] = [];
	if (tracking.first && startDay <= endDay) {
		for (let w = weekStart(startDay); w <= endDay && weeks.length < 600; w = addDays(w, 7)) {
			const [y, m, d] = w.split('-').map(Number);
			weeks.push({
				key: w,
				label: `w/c ${d} ${MONTHS[m - 1]} ${y}`,
				views: 0,
				photos: 0,
				albums: 0
			});
		}
		const index = new Map(weeks.map((week, i) => [week.key, i]));
		for (const row of rows) {
			const week = weeks[index.get(weekStart(row.day)) ?? -1];
			if (!week) continue;
			week.views += row.views;
			week.photos += row.photos;
			week.albums += row.albums;
		}
	}
	return {
		trackingSince: tracking.first,
		weeks,
		totals: {
			views: rows.reduce((s, r) => s + r.views, 0),
			photos: rows.reduce((s, r) => s + r.photos, 0),
			albums: rows.reduce((s, r) => s + r.albums, 0)
		},
		top
	};
}

export function insights(range: Range) {
	const everything = entries();
	const inRange = (r: Pick<Range, 'from' | 'to'>) =>
		everything.filter((entry) => entry.day >= r.from && entry.day <= r.to);
	const current = inRange(range);

	const keys = months(range);
	const byMonth = new Map(
		keys.map((key) => [
			key,
			{ paid: 0, invoiced: 0, booked: 0, tentative: 0, jobs: new Set<number>() }
		])
	);
	for (const entry of current) {
		const bucket = byMonth.get(entry.day.slice(0, 7));
		if (!bucket) continue;
		bucket[entry.stage] += entry.amount;
		if (entry.bookingId !== null && entry.stage !== 'tentative') bucket.jobs.add(entry.bookingId);
	}
	const today = todayIso().slice(0, 7);
	const monthly = keys.map((key, i) => {
		const bucket = byMonth.get(key)!;
		return {
			key,
			...monthLabel(key, i === 0),
			future: key > today,
			values: {
				paid: bucket.paid,
				invoiced: bucket.invoiced,
				booked: bucket.booked,
				tentative: bucket.tentative
			},
			jobs: bucket.jobs.size
		};
	});

	const confirmedEntries = current.filter((e) => e.stage !== 'tentative');
	const ranked = (map: Map<string, number>, limit: number) => {
		const sorted = [...map.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
		const head = sorted.slice(0, limit).map(([label, value]) => ({ key: label, label, value }));
		const rest = sorted.slice(limit);
		if (rest.length) {
			head.push({
				key: '__other',
				label: `${rest.length} other${rest.length === 1 ? '' : 's'}`,
				value: rest.reduce((s, [, v]) => s + v, 0)
			});
		}
		return head;
	};

	const stats = moneyStats(current);
	const previous = range.previous ? moneyStats(inRange(range.previous)) : null;

	return {
		range,
		stats: { ...stats, daysToPayment: daysToPayment(range) },
		previous: previous && range.previous ? { ...previous, label: range.previous.label } : null,
		monthly,
		byClient: ranked(
			sumBy(
				confirmedEntries,
				(e) => e.client,
				(e) => e.amount
			),
			7
		),
		byBilling: ranked(
			sumBy(
				confirmedEntries,
				(e) => e.billing,
				(e) => e.amount
			),
			5
		),
		gallery: galleryActivity(range)
	};
}
