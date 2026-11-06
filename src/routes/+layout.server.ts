import { publicSettings } from '#lib/server/settings.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		settings: publicSettings(),
		isAdmin: locals.isAdmin
	};
};
