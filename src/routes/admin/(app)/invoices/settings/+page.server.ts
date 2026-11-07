import { fail } from '@sveltejs/kit';
import {
	createBillingAddress,
	deleteBillingAddress,
	getBillingAddress,
	getInvoiceSettings,
	listBillingAddresses,
	updateBillingAddress,
	updateInvoiceSettings
} from '#lib/server/billing.js';
import { requireAdmin } from '#lib/server/guard.js';
import { getTheme, hasTheme, themeSummaries } from '#lib/server/themes.js';
import { moneyInput, parseMoney } from '#lib/money.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals);
	const current = getInvoiceSettings();
	return {
		current: { ...current, style: getTheme(current.style).id },
		rate: moneyInput(current.hourlyRate),
		addresses: listBillingAddresses(),
		themes: themeSummaries()
	};
};

function text(data: FormData, name: string, max = 2000) {
	return String(data.get(name) ?? '')
		.replace(/\r\n/g, '\n')
		.trim()
		.slice(0, max);
}

function addressInput(data: FormData) {
	return {
		label: text(data, 'label', 40),
		organisation: text(data, 'organisation', 200),
		address: text(data, 'address', 1000)
	};
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const current = getInvoiceSettings();

		const email = text(data, 'senderEmail', 200);
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, { error: 'Your email address doesn’t look right.' });
		}
		const rate = parseMoney(text(data, 'hourlyRate'));
		if (rate === null || rate < 0) return fail(400, { error: 'Enter the hourly rate in pounds.' });
		const terms = Number(text(data, 'paymentTermsDays'));
		if (!Number.isInteger(terms) || terms < 0 || terms > 365) {
			return fail(400, { error: 'Payment terms should be a number of days, 0–365.' });
		}
		const style = text(data, 'style', 40);

		updateInvoiceSettings({
			sender: {
				name: text(data, 'senderName', 200),
				address: text(data, 'senderAddress', 1000),
				phone: text(data, 'senderPhone', 60),
				email
			},
			paymentDetails: text(data, 'paymentDetails'),
			notes: text(data, 'notes', 4000),
			itemDescription: text(data, 'itemDescription', 300) || current.itemDescription,
			hourlyRate: rate,
			paymentTermsDays: terms,
			dueOnShootDate: data.get('dueOnShootDate') === 'on',
			style: hasTheme(style) ? style : current.style
		});
		return { saved: 'settings' };
	},

	addAddress: async ({ request, locals }) => {
		requireAdmin(locals);
		const input = addressInput(await request.formData());
		if (!input.label || !input.organisation) {
			return fail(400, { error: 'Give the address a short name and an organisation.' });
		}
		createBillingAddress(input);
		return { saved: 'address-added' };
	},

	updateAddress: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const address = getBillingAddress(Number(data.get('id')));
		if (!address) return fail(404, { error: 'That address no longer exists.' });
		const input = addressInput(data);
		if (!input.label || !input.organisation) {
			return fail(400, { error: 'Give the address a short name and an organisation.' });
		}
		updateBillingAddress(address.id, input);
		return { saved: 'address' };
	},

	deleteAddress: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		deleteBillingAddress(Number(data.get('id')));
		return { saved: 'address-deleted' };
	}
};
