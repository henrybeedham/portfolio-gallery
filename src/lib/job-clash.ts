/**
 * Spotting jobs booked on top of each other. Jobs on the same day are worth a mention; jobs whose
 * times overlap are a clash. Cancelled jobs never count.
 */
import type { BookingStatus } from './types.js';

export interface ClashJob {
	id: number;
	title: string;
	/** Naive local YYYY-MM-DDTHH:mm, or just the date. */
	startsAt: string | null;
	endsAt: string | null;
	status: BookingStatus;
}

export interface Clash {
	job: ClashJob;
	/** True when both have times and they overlap; false when they only share the day. */
	overlap: boolean;
}

const minutes = (value: string) => {
	const [h, m] = value.slice(11, 16).split(':').map(Number);
	return h * 60 + m;
};

/** How long a job without an end time is assumed to last. */
const ASSUMED_MINUTES = 120;

/**
 * Start and end in minutes from midnight. An end before the start runs into the next day; with no
 * end, the job is assumed to last two hours.
 */
function span(job: Pick<ClashJob, 'startsAt' | 'endsAt'>): [number, number] | null {
	if (!job.startsAt || job.startsAt.length <= 10) return null;
	const start = minutes(job.startsAt);
	if (!job.endsAt) return [start, start + ASSUMED_MINUTES];
	let end = minutes(job.endsAt);
	if (end < start) end += 24 * 60;
	return [start, end];
}

export function clashesFor(
	job: Pick<ClashJob, 'startsAt' | 'endsAt' | 'status'> & { id?: number },
	others: ClashJob[]
): Clash[] {
	if (!job.startsAt || job.status === 'cancelled') return [];
	const day = job.startsAt.slice(0, 10);
	const mine = span(job);
	return others
		.filter(
			(other) =>
				other.id !== job.id && other.status !== 'cancelled' && other.startsAt?.slice(0, 10) === day
		)
		.map((other) => {
			const theirs = span(other);
			// Touching ends (one finishes at 19:00, the next starts at 19:00) aren't a clash.
			const overlap = !!mine && !!theirs && mine[0] < theirs[1] && theirs[0] < mine[1];
			return { job: other, overlap };
		})
		.sort((a, b) => Number(b.overlap) - Number(a.overlap));
}
