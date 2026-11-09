/**
 * End times for jobs from before jobs had them, worked out from their invoices. Every invoice line is
 * taken as hours worked, and an invoice shared between jobs counts evenly towards each of them, as
 * its money does. Jobs without a start time, or with a day's hours or more, are left for you to fill
 * in by hand. A migration runs this once.
 */
import type { DatabaseSync } from 'node:sqlite';
import { jobEndFromHours } from '#lib/utils.js';

export function fillEndTimesFromInvoices(db: DatabaseSync) {
	const jobs = db
		.prepare('SELECT id, starts_at FROM bookings WHERE ends_at IS NULL AND starts_at IS NOT NULL')
		.all() as { id: number; starts_at: string }[];
	const invoices = db.prepare(
		`SELECT i.items, (SELECT COUNT(*) FROM invoice_bookings s WHERE s.invoice_id = i.id) AS jobs
		 FROM invoices i JOIN invoice_bookings l ON l.invoice_id = i.id
		 WHERE l.booking_id = ?`
	);
	const update = db.prepare('UPDATE bookings SET ends_at = ? WHERE id = ?');

	for (const job of jobs) {
		let hours = 0;
		for (const invoice of invoices.all(job.id) as { items: string; jobs: number }[]) {
			let items: { quantity?: unknown }[] = [];
			try {
				items = JSON.parse(invoice.items) ?? [];
			} catch {
				items = [];
			}
			const quantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
			hours += quantity / Math.max(1, invoice.jobs);
		}
		const endsAt = jobEndFromHours(job.starts_at, hours);
		if (endsAt) update.run(endsAt, job.id);
	}
}
