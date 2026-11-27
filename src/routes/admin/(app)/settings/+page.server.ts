import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { fail } from '@sveltejs/kit';
import { sendDiscord } from '#lib/server/discord.js';
import { requireAdmin } from '#lib/server/guard.js';
import { detectType, removeHeroImage, saveHeroImage, tempFile } from '#lib/server/images.js';
import { getSettings, updateSettings } from '#lib/server/settings.js';
import { listPasskeys } from '#lib/server/passkeys.js';
import { listPushDevices, vapidPublicKey } from '#lib/server/push.js';
import { getInvoiceSettings } from '#lib/server/billing.js';
import { albumThemeCounts, listFeaturableAlbums } from '#lib/server/albums.js';
import { getTheme, hasTheme, themeSummaries } from '#lib/server/themes.js';
import {
	LAYOUTS,
	SORT_ORDERS,
	type Layout,
	type SiteSettings,
	type SortOrder
} from '#lib/types.js';
import { plural } from '#lib/utils.js';
import type { Actions, PageServerLoad } from './$types';

/** What uses each theme (the site, new invoices, albums), for the theme list. */
function themesInUse(settings: SiteSettings) {
	const uses: Record<string, string[]> = {};
	const add = (id: string, use: string) => (uses[id] ??= []).push(use);
	add(getTheme(settings.theme).id, 'the site');
	add(getTheme(getInvoiceSettings().style).id, 'new invoices');
	if (hasTheme(settings.defaultAlbumTheme)) add(settings.defaultAlbumTheme, 'new albums');
	for (const [id, count] of albumThemeCounts()) {
		if (hasTheme(id)) add(id, plural(count, 'album'));
	}
	return Object.fromEntries(
		Object.entries(uses).map(([id, list]) => [
			id,
			list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]
		])
	);
}

export const load: PageServerLoad = ({ locals, depends }) => {
	requireAdmin(locals);
	depends('admin:push');
	depends('admin:passkeys');
	const current = getSettings();
	return {
		current: {
			...current,
			theme: getTheme(current.theme).id,
			defaultAlbumTheme: hasTheme(current.defaultAlbumTheme) ? current.defaultAlbumTheme : ''
		},
		featurable: listFeaturableAlbums(),
		themes: themeSummaries(),
		themesInUse: themesInUse(current),
		push: { publicKey: vapidPublicKey(), devices: listPushDevices() },
		passkeys: listPasskeys()
	};
};

function text(data: FormData, name: string, max = 5000) {
	return String(data.get(name) ?? '')
		.replace(/\r\n/g, '\n')
		.trim()
		.slice(0, max);
}

function isWebhook(url: string) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'https:' && parsed.pathname.startsWith('/api/webhooks/');
	} catch {
		return false;
	}
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const current = getSettings();

		const email = text(data, 'contactEmail', 200);
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, { error: 'The contact email address doesn’t look right.' });
		}
		const webhook = text(data, 'discordWebhook', 500);
		if (webhook && !isWebhook(webhook)) {
			return fail(400, {
				error: 'The Discord webhook URL should look like https://discord.com/api/webhooks/…'
			});
		}

		const layout = text(data, 'defaultLayout') as Layout;
		const sort = text(data, 'defaultSort') as SortOrder;
		const albumTheme = text(data, 'defaultAlbumTheme');
		const featuredId = Number(text(data, 'featuredAlbumId')) || null;
		const featurable = listFeaturableAlbums().some((album) => album.id === featuredId);

		const patch: Partial<SiteSettings> = {
			siteTitle: text(data, 'siteTitle', 120) || current.siteTitle,
			copyright: text(data, 'copyright', 300),
			heroTitle: text(data, 'heroTitle', 300),
			heroDescription: text(data, 'heroDescription', 1000),
			featuredAlbumId: featurable ? featuredId : null,
			galleriesIntro: text(data, 'galleriesIntro', 1000),
			aboutTitle: text(data, 'aboutTitle', 200),
			aboutText: text(data, 'aboutText', 10000),
			contactEmail: email,
			contactPhone: text(data, 'contactPhone', 60),
			showContactOnHome: data.get('showContactOnHome') === 'on',
			enquiryForm: data.get('enquiryForm') === 'on',
			discordWebhook: webhook,
			theme: hasTheme(text(data, 'theme')) ? text(data, 'theme') : current.theme,
			defaultDescription: text(data, 'defaultDescription', 20000),
			defaultAlbumTheme: hasTheme(albumTheme) ? albumTheme : '',
			defaultLayout: LAYOUTS.includes(layout) ? layout : current.defaultLayout,
			defaultSort: SORT_ORDERS.includes(sort) ? sort : current.defaultSort,
			defaultPublic: data.get('defaultPublic') === 'on',
			defaultShowOnHome: data.get('defaultShowOnHome') === 'on'
		};

		const hero = data.get('heroImage');
		if (hero instanceof File && hero.size > 0) {
			const tmp = tempFile();
			try {
				await pipeline(
					Readable.fromWeb(hero.stream() as unknown as NodeReadableStream<Uint8Array>),
					fs.createWriteStream(tmp)
				);
				if (!(await detectType(tmp))) {
					return fail(400, { error: 'The hero image must be a JPEG, PNG, WebP or GIF file.' });
				}
				await saveHeroImage(tmp);
				patch.heroImage = Date.now().toString(36);
			} catch (error) {
				console.error('[gallery] Hero image failed:', error);
				return fail(400, { error: 'The hero image could not be processed.' });
			} finally {
				await fsp.rm(tmp, { force: true });
			}
		}

		updateSettings(patch);
		return { saved: true };
	},

	removeHero: async ({ locals }) => {
		requireAdmin(locals);
		await removeHeroImage();
		updateSettings({ heroImage: null });
		return { saved: true };
	},

	testWebhook: async ({ request, locals }) => {
		requireAdmin(locals);
		const data = await request.formData();
		const webhook = text(data, 'discordWebhook', 500) || getSettings().discordWebhook;
		if (!webhook || !isWebhook(webhook)) {
			return fail(400, { error: 'Enter a valid Discord webhook URL first.' });
		}
		const ok = await sendDiscord(
			{
				title: 'Test notification',
				description: `Notifications from **${getSettings().siteTitle}** are working.`
			},
			webhook
		);
		if (!ok)
			return fail(400, { error: 'Discord rejected the test message. Check the webhook URL.' });
		return { tested: true };
	}
};
