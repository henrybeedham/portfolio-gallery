import { fail, redirect } from '@sveltejs/kit';
import { createAlbum } from '#lib/server/albums.js';
import { parseAlbumForm } from '#lib/server/album-form.js';
import { requireAdmin } from '#lib/server/guard.js';
import { getBooking, linkAlbum } from '#lib/server/bookings.js';
import { getSettings } from '#lib/server/settings.js';
import { slugify } from '#lib/utils.js';
import type { Actions, PageServerLoad } from './$types';

/** ?job=<id> starts the album from a job and links them once it's created. */
function jobFrom(url: URL) {
	const id = Number(url.searchParams.get('job'));
	return id ? getBooking(id) : undefined;
}

export const load: PageServerLoad = ({ locals, url }) => {
	requireAdmin(locals);
	const settings = getSettings();
	const job = jobFrom(url);
	return {
		origin: url.origin,
		job: job ? { id: job.id, title: job.title } : null,
		defaults: {
			title: job?.title ?? '',
			slug: job ? slugify(job.title) : '',
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
	default: async ({ request, locals, url }) => {
		requireAdmin(locals);
		const result = parseAlbumForm(await request.formData());
		if (!result.ok) return fail(400, { error: result.error, field: result.field ?? null });
		const id = createAlbum(result.input);
		const job = jobFrom(url);
		if (job) linkAlbum(job.id, id);
		redirect(303, `/admin/albums/${id}`);
	}
};
