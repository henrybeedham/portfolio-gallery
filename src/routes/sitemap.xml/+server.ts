import { listIndexableAlbums } from '#lib/server/albums.js';
import { all, placeholders } from '#lib/server/db.js';
import { mediaUrl } from '#lib/utils.js';
import type { RequestHandler } from './$types';

/** Google reads at most this many images per page. */
const IMAGES_PER_PAGE = 1000;

const escapeXml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The homepage and the albums reachable from it (`isIndexable`), with their photos as image entries.
 * Link-only albums are left out, so the sitemap never reveals them.
 */
export const GET: RequestHandler = ({ url }) => {
	const albums = listIndexableAlbums();
	const slugs = albums.map((album) => album.slug);
	const photos = slugs.length
		? all<{ slug: string; key: string; version: number }>(
				`SELECT a.slug, p.key, p.version FROM photos p JOIN albums a ON a.id = p.album_id
				 WHERE a.slug IN (${placeholders(slugs.length)})
				 ORDER BY COALESCE(p.taken_at, p.created_at), p.id`,
				...slugs
			)
		: [];
	const images = new Map<string, string[]>();
	for (const photo of photos) {
		const list = images.get(photo.slug) ?? [];
		if (list.length < IMAGES_PER_PAGE) {
			list.push(
				`${url.origin}${mediaUrl({ key: photo.key, v: photo.version, w: 0, h: 0 }, 'medium')}`
			);
		}
		images.set(photo.slug, list);
	}

	const entries = [
		`<url><loc>${escapeXml(`${url.origin}/`)}</loc></url>`,
		...albums.map((album) => {
			const pictures = (images.get(album.slug) ?? [])
				.map((src) => `<image:image><image:loc>${escapeXml(src)}</image:loc></image:image>`)
				.join('');
			return `<url><loc>${escapeXml(`${url.origin}/${album.slug}`)}</loc><lastmod>${album.updatedAt.slice(0, 10)}</lastmod>${pictures}</url>`;
		})
	];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>
`;
	return new Response(xml, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
