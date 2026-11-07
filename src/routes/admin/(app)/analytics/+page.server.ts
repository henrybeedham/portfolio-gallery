import { requireAdmin } from '#lib/server/guard.js';
import { insights, PERIODS, rangeFor, type Period } from '#lib/server/insights.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	requireAdmin(locals);
	const requested = url.searchParams.get('period') as Period;
	const period = PERIODS.includes(requested) ? requested : 'academic';
	return {
		insights: insights(period),
		periods: PERIODS.map((id) => ({ id, label: rangeFor(id).label }))
	};
};
