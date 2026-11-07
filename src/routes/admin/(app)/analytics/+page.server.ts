import { requireAdmin } from '#lib/server/guard.js';
import { customRange, insights, PRESETS, rangeFor, type Preset } from '#lib/server/insights.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	requireAdmin(locals);
	// ?from=YYYY-MM-DD&to=YYYY-MM-DD for a custom range, otherwise ?period=<preset>.
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const requested = url.searchParams.get('period') as Preset;
	const range =
		(from && to ? customRange(from, to) : null) ??
		rangeFor(PRESETS.includes(requested) ? requested : 'academic');
	return {
		insights: insights(range),
		presets: PRESETS.map((id) => ({ id, label: rangeFor(id).label }))
	};
};
