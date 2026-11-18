import { publicSettings } from '#lib/server/settings.js';
import { pageTheme } from '#lib/server/themes.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	// Re-run when a `?design=` preview link is followed (see hooks.server.ts).
	void url.searchParams.get('design');
	const settings = publicSettings();
	return {
		settings,
		// Album pages return their own `theme`, which replaces this one in `page.data`.
		theme: pageTheme(settings.theme),
		design: locals.design,
		isAdmin: locals.isAdmin
	};
};
