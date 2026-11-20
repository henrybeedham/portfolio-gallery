import { listApiTokens } from '#lib/server/api-tokens.js';
import { requireAdmin } from '#lib/server/guard.js';
import { getSettings } from '#lib/server/settings.js';
import { widgetData } from '#lib/server/widget.js';
import { widgetScript } from '#lib/server/widget-script.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, depends, url }) => {
	requireAdmin(locals);
	depends('admin:widgets');
	return {
		tokens: listApiTokens('widget'),
		// The same summary the widgets fetch, for the previews.
		widget: widgetData(url.origin),
		script: widgetScript(url.origin, getSettings().siteTitle)
	};
};
