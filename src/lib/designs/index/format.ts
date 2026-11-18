/** A plain YYYY-MM-DD date as “15.10.2026”, for mono metadata. */
export function formatNumericDay(day: string | null | undefined): string {
	if (!day) return '';
	const [y, m, d] = day.slice(0, 10).split('-');
	if (!y || !m || !d) return day;
	return `${d}.${m}.${y}`;
}

/** “01”, “02” … for numbered items and sections. */
export function indexNumber(n: number, width = 2): string {
	return String(n).padStart(width, '0');
}
