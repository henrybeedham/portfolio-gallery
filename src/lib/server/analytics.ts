import { placeholders, run, transaction } from './db.js';
import type { Album } from './albums.js';
import { notify, notifyPhotoDownload } from './discord.js';
import type { PhotoRow } from './photos.js';

const BOT_PATTERN =
	/bot|crawl|spider|slurp|facebookexternalhit|preview|embed|whatsapp|telegram|discord|slack|curl|wget|python|headless/i;

const recentViews = new Map<string, number>();
const VIEW_WINDOW = 30 * 60 * 1000;

/** Counts a page view, ignoring bots and repeat views from the same visitor within 30 minutes. */
export function recordView(album: Album, visitor: string, userAgent: string | null) {
	if (!userAgent || BOT_PATTERN.test(userAgent)) return;
	const now = Date.now();
	const key = `${album.id}:${visitor}:${userAgent.length}`;
	const last = recentViews.get(key);
	if (last && now - last < VIEW_WINDOW) return;
	recentViews.set(key, now);
	if (recentViews.size > 20_000) {
		for (const [k, t] of recentViews) if (now - t > VIEW_WINDOW) recentViews.delete(k);
	}
	run('UPDATE albums SET views = views + 1 WHERE id = ?', album.id);
}

export function recordPhotoDownload(album: Album, photo: PhotoRow, origin: string) {
	transaction(() => {
		run('UPDATE photos SET downloads = downloads + 1 WHERE id = ?', photo.id);
		run('UPDATE albums SET photo_downloads = photo_downloads + 1 WHERE id = ?', album.id);
	});
	notifyPhotoDownload(
		{ id: album.id, title: album.title, url: `${origin}/${album.slug}` },
		photo.original_name
	);
}

export function recordZipDownload(album: Album, photoIds: number[] | null, origin: string) {
	if (photoIds === null) {
		run('UPDATE albums SET album_downloads = album_downloads + 1 WHERE id = ?', album.id);
		notify({
			title: 'Full album downloaded',
			description: `**${album.title}** was downloaded as a ZIP archive.`,
			url: `${origin}/${album.slug}`
		});
		return;
	}
	if (!photoIds.length) return;
	transaction(() => {
		run(
			`UPDATE photos SET downloads = downloads + 1 WHERE album_id = ? AND id IN (${placeholders(photoIds.length)})`,
			album.id,
			...photoIds
		);
		run(
			'UPDATE albums SET photo_downloads = photo_downloads + ? WHERE id = ?',
			photoIds.length,
			album.id
		);
	});
	notify({
		title: `${photoIds.length} selected photo${photoIds.length === 1 ? '' : 's'} downloaded`,
		description: `**${album.title}** — selection downloaded as a ZIP archive.`,
		url: `${origin}/${album.slug}`
	});
}

export function clearAnalytics(albumId: number) {
	transaction(() => {
		run(
			'UPDATE albums SET views = 0, photo_downloads = 0, album_downloads = 0 WHERE id = ?',
			albumId
		);
		run('UPDATE photos SET downloads = 0 WHERE album_id = ?', albumId);
	});
}
