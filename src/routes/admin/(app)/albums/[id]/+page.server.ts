import { fail } from '@sveltejs/kit';
import { albumIsExpired, albumPhotoStats, updateAlbum } from '#lib/server/albums.js';
import { parseAlbumForm } from '#lib/server/album-form.js';
import { requireAdmin, requireAlbum } from '#lib/server/guard.js';
import { runningJob } from '#lib/server/jobs.js';
import { adminPhotos, albumTags } from '#lib/server/photos.js';
import { importDir } from '#lib/server/config.js';
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
			backgroundPhotoId: album.backgroundPhotoId,
			views: album.views,
			photoDownloads: album.photoDownloads,
			albumDownloads: album.albumDownloads,
			createdAt: album.createdAt,
			accentColor: album.accentColor
		},
		form: {
			title: album.title,
			slug: album.slug,
			description: album.description,
			albumDate: album.albumDate ?? '',
			isPublic: album.isPublic,
			showOnHome: album.showOnHome,
			showOnGalleries: album.showOnGalleries,
			isFeatured: album.isFeatured,
			passwordEnabled: !!album.passwordHash,
			expiresAt: album.expiresAt ?? '',
			accentColor: album.accentColor,
			layout: album.layout,
			sortOrder: album.sortOrder
		},
		photos: adminPhotos(album.id),
		tags: albumTags(album.id),
		stats,
		job: runningJob(album.id)
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
