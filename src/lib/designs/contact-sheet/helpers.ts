/** A lab-stamp date, “18.11.26”, for edge print and labels. Empty for no date. */
export function formatStampDate(day: string | null | undefined): string {
	if (!day) return '';
	const [y, m, d] = day.slice(0, 10).split('-');
	if (!y || !m || !d) return day;
	return `${d}.${m}.${y.slice(2)}`;
}

/** A frame or roll number padded to two digits: 1 → “01”. */
export function frameNo(n: number): string {
	return String(n).padStart(2, '0');
}
