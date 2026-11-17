import type { Booking } from './types.js';

/** Where a job is in the process, shown as a coloured stripe and icon in admin lists. */
export type Stage =
	'overdue' | 'deliver' | 'invoice' | 'awaiting' | 'upcoming' | 'tentative' | 'done';

// In the order keys show them.
export const stageLabels: Record<Stage, string> = {
	overdue: 'Overdue',
	deliver: 'To deliver',
	invoice: 'To invoice',
	awaiting: 'Awaiting payment',
	upcoming: 'Upcoming',
	tentative: 'Tentative',
	done: 'Done'
};

/** Most pressing first. Cancelled jobs have no stage. */
export function stageOf(b: Booking): Stage | null {
	if (b.status === 'cancelled') return null;
	if (b.payment === 'overdue') return 'overdue';
	if (b.status === 'tentative') return 'tentative';
	if (b.upcoming) return 'upcoming';
	if (!b.delivered) return 'deliver';
	if (b.payment === 'not-invoiced' || b.payment === 'draft') return 'invoice';
	if (b.payment !== 'paid') return 'awaiting';
	return 'done';
}
