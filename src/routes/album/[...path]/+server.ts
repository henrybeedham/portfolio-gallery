import { redirect } from '@sveltejs/kit';
import { get } from '#lib/server/db.js';
import { slugify } from '#lib/utils.js';
import type { RequestHandler } from './$types';

/** Looks up an imported album/photo; the mapping table only exists after scripts/import-legacy.sh ran. */
function lookup<T>(sql: string, param: string | number): T | undefined {
	try {
		return get<T>(sql, param);
	} catch {
		return undefined;
	}
}

/**
 * Permanent redirects for links from the previous version of the gallery:
 * /album/<slug> → /<slug> and /album/<slug>/photo/<id> → /<slug>/photo/<new id>.
 */
export const GET: RequestHandler = ({ params }) => {
	// SvelteKit has already decoded the path.
	const [oldSlug, kind, oldId] = params.path.split('/');
	if (!oldSlug) redirect(301, '/galleries');

	if (kind === 'photo' && /^\d+$/.test(oldId ?? '')) {
		const photo = lookup<{ id: number; slug: string }>(
			`SELECT p.id, a.slug FROM legacy_import_map m
			 JOIN photos p ON p.id = m.new_id JOIN albums a ON a.id = p.album_id
			 WHERE m.kind = 'photo' AND m.old_id = ?`,
			Number(oldId)
		);
		if (photo) redirect(301, `/${photo.slug}/photo/${photo.id}`);
	}

	const album = lookup<{ slug: string }>(
		`SELECT a.slug FROM legacy_import_map m JOIN albums a ON a.id = m.new_id
		 WHERE m.kind = 'album' AND m.old_slug = ?`,
		oldSlug
	);
	redirect(301, `/${album?.slug ?? (slugify(oldSlug) || '')}`);
};
