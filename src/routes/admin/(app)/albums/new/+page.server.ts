import { fail, redirect } from '@sveltejs/kit';
import { createAlbum } from '#lib/server/albums.js';
import { parseAlbumForm } from '#lib/server/album-form.js';
import { requireAdmin } from '#lib/server/guard.js';
import { getSettings } from '#lib/server/settings.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	requireAdmin(locals);
	const settings = getSettings();
	return {
		origin: url.origin,
		defaults: {
			title: '',
			slug: '',
			description: settings.defaultDescription,
			albumDate: '',
			isPublic: settings.defaultPublic,
			showOnHome: settings.defaultShowOnHome,
			showOnGalleries: true,
			isFeatured: false,
			passwordEnabled: false,
			expiresAt: '',
			accentColor: settings.defaultAccentColor,
			layout: settings.defaultLayout,
			sortOrder: settings.defaultSort
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireAdmin(locals);
		const result = parseAlbumForm(await request.formData());
		if (!result.ok) return fail(400, { error: result.error, field: result.field ?? null });
		const id = createAlbum(result.input);
		redirect(303, `/admin/albums/${id}`);
	}
};
