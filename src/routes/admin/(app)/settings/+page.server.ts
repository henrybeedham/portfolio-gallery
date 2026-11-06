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
import {
	LAYOUTS,
	SORT_ORDERS,
	THEMES,
	type Layout,
	type SiteSettings,
	type SortOrder,
	type Theme
} from '#lib/types.js';
import { isHexColor } from '#lib/utils.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireAdmin(locals);
	return { current: getSettings() };
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
		const accent = text(data, 'defaultAccentColor');

		const patch: Partial<SiteSettings> = {
			siteTitle: text(data, 'siteTitle', 120) || current.siteTitle,
			copyright: text(data, 'copyright', 300),
			heroTitle: text(data, 'heroTitle', 300),
			heroDescription: text(data, 'heroDescription', 1000),
			galleriesIntro: text(data, 'galleriesIntro', 1000),
			aboutTitle: text(data, 'aboutTitle', 200),
			aboutText: text(data, 'aboutText', 10000),
			contactEmail: email,
			contactPhone: text(data, 'contactPhone', 60),
			showContactOnHome: data.get('showContactOnHome') === 'on',
			discordWebhook: webhook,
			theme: (THEMES as string[]).includes(text(data, 'theme'))
				? (text(data, 'theme') as Theme)
				: 'light',
			defaultDescription: text(data, 'defaultDescription', 20000),
			defaultAccentColor: isHexColor(accent) ? accent.toLowerCase() : current.defaultAccentColor,
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
