/**
 * The summary that Home Screen widgets show (Scriptable on iPhone, /api/widget): upcoming jobs,
 * money, gallery activity and what needs doing. Everything is formatted here, so the widget script
 * only lays it out, and the admin Widgets page previews the same data.
 */
import { all } from './db.js';
import { dashboard } from './dashboard.js';
import { listBookings } from './bookings.js';
import { getSettings } from './settings.js';
import { getTheme, listThemes } from './themes.js';
import { formatMoney } from '#lib/money.js';
import { addDays, formatJobDate, todayIso } from '#lib/utils.js';
import type { WidgetColor, WidgetColors, WidgetData, WidgetJob, WidgetTask } from '#lib/types.js';

function parseColor(value: string | undefined, fallback: WidgetColor): WidgetColor {
	if (!value) return fallback;
	let match = /^#([0-9a-f]{3,8})$/i.exec(value.trim());
	if (match) {
		let hex = match[1];
		if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join('');
		if (hex.length === 6) return [`#${hex}`, 1];
		if (hex.length === 8) return [`#${hex.slice(0, 6)}`, parseInt(hex.slice(6), 16) / 255];
		return fallback;
	}
	match = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+)(%?))?\s*\)$/i.exec(
		value.trim()
	);
	if (match) {
		const hex = match
			.slice(1, 4)
			.map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
			.join('');
		const alpha = match[4] ? Number(match[4]) / (match[5] ? 100 : 1) : 1;
		return [`#${hex}`, Math.max(0, Math.min(1, alpha))];
	}
	return fallback;
}

function widgetColors(colors: Record<string, string>): WidgetColors {
	const text = parseColor(colors.text, ['#26231f', 1]);
	return {
		bg: parseColor(colors.bg, ['#f6f1e8', 1]),
		surface: parseColor(colors.surface, ['#efe8dc', 1]),
		text,
		muted: parseColor(colors['text-muted'], text),
		subtle: parseColor(colors['text-subtle'], text),
		border: parseColor(colors.border, ['#ddd4c5', 1]),
		highlight: parseColor(colors.highlight, text),
		danger: parseColor(colors.danger, ['#9d3b2b', 1]),
		warning: parseColor(colors.warning, ['#8f6a1d', 1]),
		success: parseColor(colors.success, ['#3e6a4a', 1])
	};
}

function daysBetween(from: string, to: string) {
	return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function whenLabel(days: number) {
	if (days === 0) return 'Today';
	if (days === 1) return 'Tomorrow';
	return `In ${days} days`;
}

export function widgetData(origin: string): WidgetData {
	const settings = getSettings();
	const today = todayIso();
	const board = dashboard();
	const theme = getTheme(settings.theme);

	// Today's jobs stay on the widget all day, not just until they start.
	const jobs = listBookings()
		.filter((b) => b.status !== 'cancelled' && b.startsAt && b.startsAt.slice(0, 10) >= today)
		.slice(0, 8)
		.map((b): WidgetJob => {
			const { time } = formatJobDate(b.startsAt, b.endsAt);
			const start = new Date(`${b.startsAt!.slice(0, 10)}T00:00:00Z`);
			const part = (options: Intl.DateTimeFormatOptions) =>
				start.toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
			const weekday = part({ weekday: 'short' });
			const date = part({ day: 'numeric' });
			const daysUntil = daysBetween(today, b.startsAt!.slice(0, 10));
			return {
				title: b.title,
				client: b.client,
				location: b.location,
				// Without the year, which the widget doesn't have room for.
				day: `${weekday} ${date} ${part({ month: 'short' })}`,
				weekday,
				date,
				time,
				daysUntil,
				when: whenLabel(daysUntil),
				tentative: b.status === 'tentative',
				url: `${origin}/admin/jobs/${b.id}`
			};
		});

	const from = addDays(today, -13);
	const rows = all<{ day: string; views: number; downloads: number }>(
		`SELECT day, SUM(views) AS views, SUM(photo_downloads + album_downloads) AS downloads
		 FROM album_daily_stats WHERE day BETWEEN ? AND ? GROUP BY day`,
		from,
		today
	);
	const byDay = new Map(rows.map((row) => [row.day, row]));
	const daily = Array.from({ length: 14 }, (_, i) => {
		const day = addDays(from, i);
		const row = byDay.get(day);
		return { day, views: row?.views ?? 0, downloads: row?.downloads ?? 0 };
	});

	const { week, previousWeek, top } = board.activity;
	const { money, attention } = board;

	const tasks: WidgetTask[] = [
		...attention.overdue.map((invoice): WidgetTask => ({
			label: invoice.billToName || `Invoice ${invoice.number}`,
			detail: `${formatMoney(invoice.total)} overdue`,
			kind: 'overdue',
			url: `${origin}/admin/invoices/${invoice.id}`
		})),
		...attention.deliver.map((job): WidgetTask => ({
			label: job.title,
			detail: 'To deliver',
			kind: 'deliver',
			url: `${origin}/admin/jobs/${job.id}`
		})),
		...attention.invoice.map((job): WidgetTask => ({
			label: job.title,
			detail: job.payment === 'draft' ? 'Draft invoice to send' : 'To invoice',
			kind: 'invoice',
			url: `${origin}/admin/jobs/${job.id}`
		}))
	];

	return {
		site: { title: settings.siteTitle, url: `${origin}/admin` },
		generatedAt: new Date().toISOString(),
		theme: theme.id,
		scheme: theme.scheme,
		themes: Object.fromEntries(
			listThemes().map((t) => [
				t.id,
				{ name: t.name, scheme: t.scheme, colors: widgetColors(t.colors) }
			])
		),
		jobs,
		money: {
			outstanding: formatMoney(money.outstanding),
			unpaidCount: money.unpaidCount,
			overdue: formatMoney(money.overdue),
			overdueCount: money.overdueCount,
			paidThisMonth: formatMoney(money.paidThisMonth),
			paidThisMonthCount: money.paidThisMonthCount,
			paidThisTaxYear: formatMoney(money.paidThisTaxYear),
			taxYear: money.taxYear,
			url: `${origin}/admin/invoices`
		},
		activity: {
			views: week.views,
			downloads: week.photoDownloads + week.albumDownloads,
			previousViews: previousWeek.views,
			previousDownloads: previousWeek.photoDownloads + previousWeek.albumDownloads,
			daily,
			top: top.map((album) => ({
				title: album.title,
				views: album.views,
				downloads: album.photoDownloads + album.albumDownloads
			})),
			url: `${origin}/admin/analytics`
		},
		todo: { count: tasks.length, tasks, url: `${origin}/admin` }
	};
}
