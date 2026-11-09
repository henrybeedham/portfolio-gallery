import type { ImageRef, SortOrder, ViewQuery } from './types.js';

export function slugify(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

export function mediaUrl(image: ImageRef, variant: 'thumb' | 'medium' | 'original') {
	return `/media/${image.key}/${variant}?v=${image.v}`;
}

export function downloadUrl(image: ImageRef) {
	return `/media/${image.key}/original?download=1`;
}

export function formatBytes(bytes: number): string {
	if (!bytes) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / 1024 ** exponent;
	return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** Formats a plain YYYY-MM-DD date without timezone shifting. */
export function formatDay(day: string | null | undefined): string {
	if (!day) return '';
	const [y, m, d] = day.slice(0, 10).split('-').map(Number);
	if (!y || !m || !d) return day;
	return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

export function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return '';
	const date = new Date(iso);
	if (isNaN(date.getTime())) return iso;
	return date.toLocaleString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

export function isExpired(expiresAt: string | null | undefined, now = Date.now()) {
	return !!expiresAt && new Date(expiresAt).getTime() <= now;
}

/** A short countdown label when an expiry date is within the next 30 days. */
export function expiryLabel(expiresAt: string | null | undefined, now = Date.now()): string | null {
	if (!expiresAt) return null;
	const remaining = new Date(expiresAt).getTime() - now;
	if (remaining <= 0) return 'Expired';
	const hours = remaining / 36e5;
	if (hours > 24 * 30) return null;
	if (hours < 1) return 'Expires in less than an hour';
	if (hours < 48)
		return `Expires in ${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'}`;
	const days = Math.round(hours / 24);
	return `Expires in ${days} days`;
}

export function plural(count: number, singular: string, pluralForm = singular + 's') {
	return `${count.toLocaleString('en-GB')} ${count === 1 ? singular : pluralForm}`;
}

/** Serialises the active tag/sort selection so it survives navigating between photos. */
export function viewQuery(
	view: ViewQuery,
	defaults: { sort: SortOrder },
	extra?: Record<string, string>
) {
	const params = new URLSearchParams();
	if (view.tag) params.set('tag', String(view.tag));
	if (view.sort !== defaults.sort) params.set('sort', view.sort);
	if (view.sort === 'random' && view.seed) params.set('seed', String(view.seed));
	for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
	const query = params.toString();
	return query ? `?${query}` : '';
}

export function paragraphs(text: string): string[] {
	return text
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
}

export function copyrightText(template: string) {
	return template.replace(/\{year\}/g, String(new Date().getFullYear()));
}

/** Today's date as YYYY-MM-DD in the server's (or browser's) local timezone. */
export function todayIso(now = new Date()): string {
	const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 10);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(day: string, days: number): string {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * When an invoice issued on `issueDate` is due: the shoot date if it's still ahead and you've asked
 * for that, otherwise after your payment terms.
 */
export function invoiceDueDate(
	issueDate: string,
	shootDay: string | null | undefined,
	terms: { dueOnShootDate: boolean; paymentTermsDays: number }
): string {
	return terms.dueOnShootDate && shootDay && shootDay >= issueDate
		? shootDay
		: addDays(issueDate, terms.paymentTermsDays);
}

/** Records imported from a job's “paid” tick can have no number. */
export function invoiceLabel(number: string): string {
	return number || 'No number';
}

export function isIsoDay(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

/** “4 Nov 2026” from YYYY-MM-DD. */
export function formatShortDay(day: string | null | undefined): string {
	if (!day) return '';
	const [y, m, d] = day.slice(0, 10).split('-').map(Number);
	if (!y || !m || !d) return day;
	return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

/** “Tue 8 Dec 2026” and “18:15” from a naive local YYYY-MM-DDTHH:mm. */
export function formatJobDate(startsAt: string | null | undefined): { day: string; time: string } {
	if (!startsAt) return { day: '', time: '' };
	const [y, m, d] = startsAt.slice(0, 10).split('-').map(Number);
	if (!y || !m || !d) return { day: startsAt, time: '' };
	const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
	const time = /T(\d{2}:\d{2})/.exec(startsAt)?.[1] ?? '';
	return { day, time: time === '00:00' ? '' : time };
}
