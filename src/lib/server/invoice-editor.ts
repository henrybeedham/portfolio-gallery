import { getInvoiceSettings, listBillingAddresses } from './billing.js';
import { bookingOptions, clientSuggestions } from './bookings.js';
import { themeSummaries } from './themes.js';

/** The lists the invoice editor's pickers need. */
export function editorOptions() {
	return {
		addresses: listBillingAddresses(),
		jobs: bookingOptions(),
		clients: clientSuggestions(),
		themes: themeSummaries(),
		invoiceSettings: getInvoiceSettings()
	};
}
