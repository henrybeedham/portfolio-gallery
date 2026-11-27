import { getFeaturedAlbum, listHomeAlbums, effectiveCoverId } from '#lib/server/albums.js';
import { isAlbumUnlocked } from '#lib/server/auth.js';
import { renderMarkdown } from '#lib/server/markdown.js';
import { createEnquiry, parseEnquiry } from '#lib/server/enquiries.js';
import { orderedPhotoIds, photoItems, randomSeed } from '#lib/server/photos.js';
import { clientIp, rateLimit } from '#lib/server/ratelimit.js';
import { getSettings } from '#lib/server/settings.js';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const FEATURED_LIMIT = 24;

export const load: PageServerLoad = ({ cookies, locals }) => {
	const album = getFeaturedAlbum();
	let featured = null;

	if (album) {
		const locked = !locals.isAdmin && !!album.passwordHash && !isAlbumUnlocked(cookies, album);
		const view = {
			sort: album.sortOrder,
			tag: null,
			seed: album.sortOrder === 'random' ? randomSeed() : null
		};
		const ids = orderedPhotoIds(album.id, view);
		const coverId = effectiveCoverId(album.id);
		featured = {
			slug: album.slug,
			title: album.title,
			descriptionHtml: renderMarkdown(album.description),
			layout: album.layout,
			sortOrder: album.sortOrder,
			// Don't reveal how many photos a locked album holds.
			total: locked ? 0 : ids.length,
			locked,
			view,
			photos: locked ? [] : photoItems(ids.slice(0, FEATURED_LIMIT)),
			cover: locked && coverId ? (photoItems([coverId])[0] ?? null) : null
		};
	}

	return {
		featured,
		albums: listHomeAlbums()
	};
};

export const actions: Actions = {
	enquire: async (event) => {
		if (!getSettings().enquiryForm)
			return fail(404, { enquiry: { error: 'Enquiries are closed.' } });
		const data = await event.request.formData();
		const values = Object.fromEntries(
			['name', 'email', 'phone', 'eventDate', 'location', 'message'].map((name) => [
				name,
				String(data.get(name) ?? '')
			])
		);
		// A field people can't see: only bots fill it in. They're told it worked, so they move on.
		if (String(data.get('website') ?? '')) return { enquiry: { sent: true } };
		// Per visitor, plus a ceiling for the whole site so a flood can't fill the inbox.
		if (
			!rateLimit(`enquiry:${clientIp(event)}`, 5, 60 * 60 * 1000) ||
			!rateLimit('enquiry-all', 60, 24 * 60 * 60 * 1000)
		) {
			return fail(429, {
				enquiry: { error: 'Too many enquiries have been sent. Please try again later.', values }
			});
		}
		const parsed = parseEnquiry(data);
		if (!parsed.ok) {
			return fail(400, { enquiry: { error: parsed.error, field: parsed.field, values } });
		}
		createEnquiry(parsed.input, event.url.origin);
		return { enquiry: { sent: true } };
	}
};
