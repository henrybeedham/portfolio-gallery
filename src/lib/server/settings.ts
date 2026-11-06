import { get, run } from './db.js';
import type { PublicSettings, SiteSettings } from '#lib/types.js';

export const defaultSettings: SiteSettings = {
	siteTitle: 'Henry Beedham Photography',
	copyright: '© {year} Henry Beedham Photography. All rights reserved.',
	heroTitle: 'Light, stillness\nand the moments\nin between',
	heroDescription:
		'Documentary and portrait photography for people, places and the quiet stories worth keeping.',
	heroImage: null,
	galleriesIntro:
		'A collection of recent commissions, personal projects and client stories, gathered in one place.',
	aboutTitle: 'About',
	aboutText:
		'I photograph people and places with a patient, unobtrusive eye — looking for honest light and unguarded moments.\n\nEvery gallery is delivered privately, in full resolution, ready to download and keep.',
	contactEmail: '',
	contactPhone: '',
	showContactOnHome: true,
	discordWebhook: '',
	theme: 'light',
	defaultDescription: '',
	defaultAccentColor: '#2a2723',
	defaultLayout: 'grid',
	defaultSort: 'oldest',
	defaultPublic: true,
	defaultShowOnHome: false
};

let cache: SiteSettings | undefined;

export function getSettings(): SiteSettings {
	if (!cache) {
		const row = get<{ value: string }>(`SELECT value FROM settings WHERE key = 'site'`);
		let stored: Partial<SiteSettings> = {};
		if (row) {
			try {
				stored = JSON.parse(row.value);
			} catch {
				stored = {};
			}
		}
		cache = { ...defaultSettings, ...stored };
	}
	return cache;
}

export function updateSettings(patch: Partial<SiteSettings>): SiteSettings {
	const next = { ...getSettings(), ...patch };
	run(
		`INSERT INTO settings (key, value) VALUES ('site', ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		JSON.stringify(next)
	);
	cache = next;
	return next;
}

export function publicSettings(settings = getSettings()): PublicSettings {
	const { discordWebhook: _discordWebhook, ...rest } = settings;
	return rest;
}
