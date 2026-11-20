import { hasPushDevices, sendPush } from './push.js';
import { getSettings } from './settings.js';

interface Embed {
	title: string;
	description?: string;
	url?: string;
	color?: number;
	fields?: { name: string; value: string; inline?: boolean }[];
}

function isDiscordWebhook(url: string) {
	try {
		const parsed = new URL(url);
		return (
			parsed.protocol === 'https:' &&
			/(^|\.)discord(app)?\.com$/.test(parsed.hostname) &&
			parsed.pathname.startsWith('/api/webhooks/')
		);
	} catch {
		return false;
	}
}

export async function sendDiscord(embed: Embed, webhook = getSettings().discordWebhook) {
	if (!webhook || !isDiscordWebhook(webhook)) return false;
	try {
		const response = await fetch(webhook, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				username: getSettings().siteTitle.slice(0, 80),
				embeds: [{ color: 0x8b6f47, timestamp: new Date().toISOString(), ...embed }]
			}),
			signal: AbortSignal.timeout(8000)
		});
		return response.ok;
	} catch (error) {
		console.warn('[gallery] Discord notification failed:', (error as Error).message);
		return false;
	}
}

/** Sends to Discord, if a webhook is set, and to any devices subscribed to push notifications. */
export function notify(embed: Embed) {
	void sendDiscord(embed);
	void sendPush({
		title: embed.title,
		// Discord's bold markers, which a notification would show literally.
		body: embed.description?.replace(/\*\*/g, ''),
		url: embed.url
	});
}

/* Individual photo downloads are batched per album so a busy client doesn't flood the channel. */
const pending = new Map<
	number,
	{ title: string; url: string; names: string[]; timer: ReturnType<typeof setTimeout> }
>();

export function notifyPhotoDownload(
	album: { id: number; title: string; url: string },
	name: string
) {
	if (!getSettings().discordWebhook && !hasPushDevices()) return;
	const entry = pending.get(album.id);
	if (entry) {
		entry.names.push(name);
		return;
	}
	const timer = setTimeout(() => {
		const batch = pending.get(album.id);
		pending.delete(album.id);
		if (!batch) return;
		const list = batch.names.slice(0, 10).map((n) => `• ${n}`);
		if (batch.names.length > 10) list.push(`…and ${batch.names.length - 10} more`);
		notify({
			title: `${batch.names.length} photo${batch.names.length === 1 ? '' : 's'} downloaded`,
			description: `**${batch.title}**\n${list.join('\n')}`,
			url: batch.url
		});
	}, 60_000);
	timer.unref?.();
	pending.set(album.id, { title: album.title, url: album.url, names: [name], timer });
}
