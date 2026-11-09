/**
 * A private iCalendar feed of your jobs. Calendar apps can't sign in, so the feed is reached through
 * an unguessable link. Resetting the token cuts off anything subscribed to the old link.
 */
import crypto from 'node:crypto';
import { safeEqual } from './auth.js';
import { listBookings } from './bookings.js';
import { get, run } from './db.js';
import { getSettings } from './settings.js';
import type { Booking } from '#lib/types.js';
import { addDays, formatJobDate } from '#lib/utils.js';

const TOKEN_KEY = 'calendar-token';

function storedToken() {
	return (
		get<{ value: string }>('SELECT value FROM settings WHERE key = ?', TOKEN_KEY)?.value ?? null
	);
}

export function resetCalendarToken(): string {
	const token = crypto.randomBytes(32).toString('base64url');
	run(
		`INSERT INTO settings (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		TOKEN_KEY,
		token
	);
	return token;
}

export function calendarToken(): string {
	return storedToken() ?? resetCalendarToken();
}

export function isCalendarToken(candidate: string): boolean {
	const token = storedToken();
	return !!token && safeEqual(candidate, token);
}

/* ------------------------------------------------------------- iCalendar */

function escapeText(value: string) {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n?|\n/g, '\\n');
}

/** Lines may be at most 75 bytes; longer ones continue on the next line after a space. */
function fold(line: string) {
	const parts: string[] = [];
	let current = '';
	let bytes = 0;
	for (const char of line) {
		const size = Buffer.byteLength(char);
		if (bytes + size > 75) {
			parts.push(current);
			current = ' ';
			bytes = 1;
		}
		current += char;
		bytes += size;
	}
	parts.push(current);
	return parts.join('\r\n');
}

const compactDay = (day: string) => day.replaceAll('-', '');

const floatingTime = (value: string) =>
	`${compactDay(value.slice(0, 10))}T${value.slice(11, 16).replace(':', '')}00`;

/**
 * Jobs store a naive local time, so events use iCalendar “floating” times: 18:15 shows as 18:15.
 * A timed job with no end is given a nominal hour. Like the jobs list, a lone midnight start
 * counts as no time at all.
 */
function eventDates(startsAt: string, endsAt: string | null) {
	if (endsAt) return [`DTSTART:${floatingTime(startsAt)}`, `DTEND:${floatingTime(endsAt)}`];
	if (formatJobDate(startsAt).time) return [`DTSTART:${floatingTime(startsAt)}`, 'DURATION:PT1H'];
	const day = startsAt.slice(0, 10);
	return [
		`DTSTART;VALUE=DATE:${compactDay(day)}`,
		`DTEND;VALUE=DATE:${compactDay(addDays(day, 1))}`
	];
}

function eventLines(booking: Booking, startsAt: string, origin: string, stamp: string) {
	const tentative = booking.status === 'tentative';
	const details = [
		[booking.client, booking.billingLabel].filter(Boolean).join(' · '),
		booking.notes
	].filter(Boolean);
	return [
		'BEGIN:VEVENT',
		`UID:job-${booking.id}@${new URL(origin).host}`,
		`DTSTAMP:${stamp}`,
		...eventDates(startsAt, booking.endsAt),
		`SUMMARY:${escapeText(tentative ? `${booking.title} (tentative)` : booking.title)}`,
		`STATUS:${tentative ? 'TENTATIVE' : 'CONFIRMED'}`,
		...(booking.location ? [`LOCATION:${escapeText(booking.location)}`] : []),
		...(details.length ? [`DESCRIPTION:${escapeText(details.join('\n\n'))}`] : []),
		`URL:${origin}/admin/jobs/${booking.id}`,
		'END:VEVENT'
	];
}

/** Every dated job that isn't cancelled. Fees and payment details stay out of it. */
export function calendarFeed(origin: string): string {
	const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Gallery//Jobs//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(`${getSettings().siteTitle} — Jobs`)}`,
		'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
		'X-PUBLISHED-TTL:PT1H',
		...listBookings().flatMap((booking) =>
			booking.startsAt && booking.status !== 'cancelled'
				? eventLines(booking, booking.startsAt, origin, stamp)
				: []
		),
		'END:VCALENDAR'
	];
	return lines.map(fold).join('\r\n') + '\r\n';
}
