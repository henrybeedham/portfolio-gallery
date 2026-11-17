/** What the admin dashboard shows: what needs doing, what's coming up, money and gallery activity. */
import { all, get } from './db.js';
import { getStats, listAdminAlbums } from './albums.js';
import { listBookings } from './bookings.js';
import { listInvoices } from './invoices.js';
import { taxYearLabel, taxYearOf } from './tax-year.js';
import { addDays, todayIso } from '#lib/utils.js';

/** How far ahead “Coming up” looks. */
const AHEAD_DAYS = 14;

interface Activity {
	views: number;
	photoDownloads: number;
	albumDownloads: number;
}

function activityBetween(from: string, to: string): Activity {
	return get<Activity>(
		`SELECT COALESCE(SUM(views), 0) AS views, COALESCE(SUM(photo_downloads), 0) AS photoDownloads,
			COALESCE(SUM(album_downloads), 0) AS albumDownloads
		 FROM album_daily_stats WHERE day BETWEEN ? AND ?`,
		from,
		to
	)!;
}

export function dashboard() {
	const today = todayIso();
	const bookings = listBookings();
	const invoices = listInvoices();
	const confirmedPast = bookings.filter((b) => b.status === 'confirmed' && !b.upcoming);

	const sum = (list: typeof invoices) => list.reduce((total, invoice) => total + invoice.total, 0);
	const unpaid = invoices.filter((i) => i.state === 'unpaid' || i.state === 'overdue');
	const overdue = invoices.filter((i) => i.state === 'overdue');
	const month = today.slice(0, 7);
	const paidThisMonth = invoices.filter((i) => i.paidAt?.startsWith(month));
	const taxYear = taxYearOf(today);
	const paidThisTaxYear = invoices.filter((i) => i.paidAt && taxYearOf(i.paidAt) === taxYear);

	const upcoming = bookings.filter((b) => b.status !== 'cancelled' && b.upcoming && b.startsAt);
	const horizon = addDays(today, AHEAD_DAYS);
	const comingUp = upcoming.filter((b) => b.startsAt!.slice(0, 10) <= horizon);

	// Gallery activity: this week (the last 7 days, today included) against the week before.
	const weekFrom = addDays(today, -6);
	const top = all<{ id: number; title: string; slug: string } & Activity>(
		`SELECT a.id, a.title, a.slug, SUM(s.views) AS views, SUM(s.photo_downloads) AS photoDownloads,
			SUM(s.album_downloads) AS albumDownloads
		 FROM album_daily_stats s JOIN albums a ON a.id = s.album_id
		 WHERE s.day BETWEEN ? AND ?
		 GROUP BY a.id
		 ORDER BY SUM(s.views) + SUM(s.photo_downloads) + SUM(s.album_downloads) DESC, a.title
		 LIMIT 5`,
		weekFrom,
		today
	);

	return {
		attention: {
			overdue,
			deliver: confirmedPast.filter((b) => !b.delivered),
			invoice: confirmedPast.filter((b) => b.payment === 'not-invoiced' || b.payment === 'draft')
		},
		comingUp,
		aheadDays: AHEAD_DAYS,
		// When nothing is booked in the next fortnight, the next job after it.
		nextAfter: comingUp.length ? null : (upcoming[0] ?? null),
		money: {
			outstanding: sum(unpaid),
			unpaidCount: unpaid.length,
			overdue: sum(overdue),
			overdueCount: overdue.length,
			paidThisMonth: sum(paidThisMonth),
			paidThisMonthCount: paidThisMonth.length,
			paidThisTaxYear: sum(paidThisTaxYear),
			paidThisTaxYearCount: paidThisTaxYear.length,
			taxYear: taxYearLabel(taxYear)
		},
		activity: {
			week: activityBetween(weekFrom, today),
			previousWeek: activityBetween(addDays(today, -13), addDays(today, -7)),
			top,
			recent: listAdminAlbums().slice(0, 4),
			totals: getStats()
		}
	};
}
