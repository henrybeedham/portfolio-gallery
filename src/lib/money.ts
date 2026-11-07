import type { InvoiceItem } from './types.js';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

/** Amounts are stored as whole pence. */
export function formatMoney(pence: number): string {
	return gbp.format((pence || 0) / 100);
}

/** Accepts “£1,250.50”, “1250.5”, “60” … and returns pence, or null if it isn't a number. */
export function parseMoney(input: string | number | null | undefined): number | null {
	if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
	const cleaned = String(input ?? '')
		.replace(/[£,\s]/g, '')
		.trim();
	if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
	return Math.round(parseFloat(cleaned) * 100);
}

/** Pence → “60.00” for form inputs. */
export function moneyInput(pence: number): string {
	return ((pence || 0) / 100).toFixed(2);
}

export function lineAmount(item: Pick<InvoiceItem, 'quantity' | 'rate'>): number {
	return Math.round((item.quantity || 0) * (item.rate || 0));
}

export function itemsTotal(items: Pick<InvoiceItem, 'quantity' | 'rate'>[]): number {
	return items.reduce((sum, item) => sum + lineAmount(item), 0);
}

/** 2.5 → “2.5”, 4 → “4”, 1.25 → “1.25”. */
export function formatQuantity(value: number): string {
	return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '0';
}

/** Hours as “2h 30m”. */
export function formatHours(hours: number): string {
	if (!hours) return '—';
	const whole = Math.floor(hours);
	const minutes = Math.round((hours - whole) * 60);
	if (!whole) return `${minutes}m`;
	return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
}
