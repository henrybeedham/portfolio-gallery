/**
 * The Scriptable script behind the iPhone widgets (scriptable/Gallery.js), with this site's address
 * filled in, and a token too when it's copied straight after one is made.
 */
const sources = import.meta.glob('/scriptable/Gallery.js', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

const source = Object.values(sources)[0] ?? '';

export function widgetScript(origin: string, siteTitle: string, token = ''): string {
	return source
		.replace(`'__SITE_URL__'`, () => JSON.stringify(origin))
		.replace(`'__TOKEN__'`, () => JSON.stringify(/^gal_[\w-]+$/.test(token) ? token : ''))
		.replace('__SITE_TITLE__', () => siteTitle.replace(/\s+/g, ' ').trim());
}
