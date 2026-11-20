/**
 * The Lightroom Classic plugin (lightroom/GalleryPublisher.lrplugin), bundled into the server so
 * it can be downloaded as a ZIP with this site's address already filled in.
 *
 * Each download carries `pluginBuild`, a fingerprint of the plugin's code, in Defaults.lua. The
 * plugin compares it with the one /api/lightroom reports, and when they differ offers to fetch
 * /api/lightroom/plugin and install it over itself (Updater.lua).
 */
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import yazl from 'yazl';

const FOLDER = 'GalleryPublisher.lrplugin';

const sources = import.meta.glob('/lightroom/GalleryPublisher.lrplugin/*.lua', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

/** Changes whenever any of the plugin's files does, apart from the generated Defaults.lua. */
export const pluginBuild = crypto
	.createHash('sha256')
	.update(
		JSON.stringify(
			Object.entries(sources)
				.filter(([file]) => !file.endsWith('/Defaults.lua'))
				.sort(([a], [b]) => a.localeCompare(b))
		)
	)
	.digest('hex')
	.slice(0, 12);

/** A Lua string literal. */
function lua(value: string) {
	return `'${value.replace(/[\\'\n\r]/g, (c) => ({ '\\': '\\\\', "'": "\\'", '\n': '\\n', '\r': '\\r' })[c]!)}'`;
}

export function pluginZip(origin: string, siteTitle: string): ReadableStream {
	const zip = new yazl.ZipFile();
	const mtime = new Date();
	for (const [file, text] of Object.entries(sources)) {
		const name = file.split('/').pop()!;
		const content =
			name === 'Defaults.lua'
				? `-- Filled in when the plugin was downloaded from ${origin}.\nreturn {\n\tserverUrl = ${lua(origin)},\n\tsiteTitle = ${lua(siteTitle)},\n\tbuild = ${lua(pluginBuild)},\n}\n`
				: text;
		zip.addBuffer(Buffer.from(content, 'utf8'), `${FOLDER}/${name}`, { mtime });
	}
	zip.end();
	return Readable.toWeb(zip.outputStream as Readable) as ReadableStream;
}
