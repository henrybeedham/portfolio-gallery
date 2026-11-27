import { fail } from '@sveltejs/kit';
import {
	albumIsExpired,
	albumPhotoStats,
	effectiveCoverId,
	updateAlbum
} from '#lib/server/albums.js';
import { albumDailyActivity } from '#lib/server/analytics.js';
import { parseAlbumForm } from '#lib/server/album-form.js';
import { requireAdmin, requireAlbum } from '#lib/server/guard.js';
import { runningJob } from '#lib/server/jobs.js';
import { adminPhotos, albumTags } from '#lib/server/photos.js';
import { importDir } from '#lib/server/config.js';
import { adminSections } from '#lib/server/sections.js';
import { bookingsForAlbum } from '#lib/server/bookings.js';
import { getSettings } from '#lib/server/settings.js';
import { getTheme, hasTheme, themeSummaries } from '#lib/server/themes.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, url, depends }) => {
	requireAdmin(locals);
	depends('admin:album');
	const album = requireAlbum(params.id);
	const stats = albumPhotoStats(album.id);

	return {
		origin: url.origin,
		importDir,
		album: {
			id: album.id,
			title: album.title,
			slug: album.slug,
			isPublic: album.isPublic,
			hasPassword: !!album.passwordHash,
			expired: albumIsExpired(album),
			coverPhotoId: album.coverPhotoId,
			/** The chosen cover, or the earliest photo standing in for one. */
			effectiveCoverId: effectiveCoverId(album.id),
			albumDate: album.albumDate,
			expiresAt: album.expiresAt,
			listed: album.showOnHome || getSettings().featuredAlbumId === album.id,
			backgroundPhotoId: album.backgroundPhotoId,
			views: album.views,
			photoDownloads: album.photoDownloads,
			albumDownloads: album.albumDownloads,
			createdAt: album.createdAt
		},
		form: {
			title: album.title,
			slug: album.slug,
			description: album.description,
			albumDate: album.albumDate ?? '',
			isPublic: album.isPublic,
			showOnHome: album.showOnHome,
			passwordEnabled: !!album.passwordHash,
			expiresAt: album.expiresAt ?? '',
			// A deleted theme shows as following the site, which is what the album falls back to.
			theme: album.theme && hasTheme(album.theme) ? album.theme : '',
			layout: album.layout,
			sortOrder: album.sortOrder,
			sectionsCollapsed: album.sectionsCollapsed
		},
		themes: themeSummaries(),
		siteTheme: getTheme(getSettings().theme).id,
		photos: adminPhotos(album.id),
		tags: albumTags(album.id),
		sections: adminSections(album.id),
		stats,
		activity: albumDailyActivity(album),
		job: runningJob(album.id),
		bookings: bookingsForAlbum(album.id).map((booking) => ({
			id: booking.id,
			title: booking.title
		}))
	};
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		requireAdmin(locals);
		const album = requireAlbum(params.id);
		const result = parseAlbumForm(await request.formData(), album);
		if (!result.ok) return fail(400, { error: result.error, field: result.field ?? null });
		updateAlbum(album.id, result.input);
		return { saved: true };
	}
};
