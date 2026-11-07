import { publicSettings } from '#lib/server/settings.js';
import { getTheme } from '#lib/server/themes.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	const settings = publicSettings();
	const theme = getTheme(settings.theme);
	return {
		settings,
		theme: { id: theme.id, color: theme.swatch.bg },
		isAdmin: locals.isAdmin
	};
};
