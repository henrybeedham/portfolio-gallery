/** Saved billing addresses and the defaults used for new invoices. */
import { all, get, run } from './db.js';
import { mergeInvoiceSettings } from './invoice-defaults.js';
import type { BillingAddress, InvoiceSettings } from '#lib/types.js';

let cache: InvoiceSettings | undefined;

export function getInvoiceSettings(): InvoiceSettings {
	if (!cache) {
		const row = get<{ value: string }>(`SELECT value FROM settings WHERE key = 'invoicing'`);
		cache = mergeInvoiceSettings(row?.value);
	}
	return cache;
}

/** Forgets the cached settings, after the database is restored from a backup. */
export function resetInvoiceSettings() {
	cache = undefined;
}

export function updateInvoiceSettings(patch: Partial<InvoiceSettings>): InvoiceSettings {
	const next = { ...getInvoiceSettings(), ...patch };
	run(
		`INSERT INTO settings (key, value) VALUES ('invoicing', ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		JSON.stringify(next)
	);
	cache = next;
	return next;
}

export function listBillingAddresses(): BillingAddress[] {
	return all<BillingAddress>(
		'SELECT id, label, organisation, address FROM billing_addresses ORDER BY position, id'
	);
}

export function getBillingAddress(id: number | null | undefined): BillingAddress | undefined {
	if (!id) return undefined;
	return get<BillingAddress>(
		'SELECT id, label, organisation, address FROM billing_addresses WHERE id = ?',
		id
	);
}

export type BillingAddressInput = Omit<BillingAddress, 'id'>;

export function createBillingAddress(input: BillingAddressInput): number {
	const next = get<{ n: number }>(
		'SELECT COALESCE(MAX(position), 0) + 1 AS n FROM billing_addresses'
	)!;
	return run(
		'INSERT INTO billing_addresses (label, organisation, address, position) VALUES (?, ?, ?, ?)',
		input.label,
		input.organisation,
		input.address,
		next.n
	).lastInsertRowid;
}

export function updateBillingAddress(id: number, input: BillingAddressInput) {
	run(
		'UPDATE billing_addresses SET label = ?, organisation = ?, address = ? WHERE id = ?',
		input.label,
		input.organisation,
		input.address,
		id
	);
}

/** Jobs and invoices keep their own copy of the address, so deleting one never changes them. */
export function deleteBillingAddress(id: number) {
	run('DELETE FROM billing_addresses WHERE id = ?', id);
}

/** The organisation and address lines, as printed under the client's name. */
export function billingAddressText(address: Pick<BillingAddress, 'organisation' | 'address'>) {
	return [address.organisation, address.address].filter((part) => part.trim()).join('\n');
}
