/**
 * Defaults for new invoices. Kept apart from billing.ts, which reads the database, so the migration
 * that opens the database can use them too.
 */
import type { InvoiceSettings } from '#lib/types.js';

const defaultInvoiceSettings: InvoiceSettings = {
	sender: { name: '', address: '', phone: '', email: '' },
	paymentDetails: '',
	notes: 'Thanks very much :)',
	itemDescription: 'Photography Services (Hourly)',
	hourlyRate: 6000,
	style: 'light',
	paymentTermsDays: 30,
	dueOnShootDate: true
};

/** The stored `invoicing` settings row (JSON) over the defaults. */
export function mergeInvoiceSettings(json: string | undefined): InvoiceSettings {
	let stored: Partial<InvoiceSettings> = {};
	try {
		stored = json ? JSON.parse(json) : {};
	} catch {
		stored = {};
	}
	return {
		...defaultInvoiceSettings,
		...stored,
		sender: { ...defaultInvoiceSettings.sender, ...stored.sender }
	};
}
