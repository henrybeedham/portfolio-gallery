import { publicSettings } from '#lib/server/settings.js';
import { pageTheme } from '#lib/server/themes.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const settings = publicSettings();
	return {
		settings,
		// Album pages return their own `theme`, which replaces this one in `page.data`.
		theme: pageTheme(settings.theme),
		isAdmin: locals.isAdmin
	};
};
