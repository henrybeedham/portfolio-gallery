/**
 * The site's icons (browser tab, Home Screen, notifications): the site title's initials in
 * Playfair Display, drawn in a theme's colours so they follow the site theme, or an album's own
 * theme on its pages. PNGs are rendered from the same SVG with sharp and kept in memory; the
 * version in the URL (`iconUrl` in themes.ts) changes when the colours or the initials do.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as fontkit from 'fontkit';
import sharp from 'sharp';
import { getSettings } from './settings.js';
import { themeVersion, type Theme } from './themes.js';
import { siteInitials } from '#lib/utils.js';

const require = createRequire(import.meta.url);

/** The same static file the invoices use (fontkit, like PDFKit, can't read WOFF2). */
const FONT_FILE = '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff';

let font: fontkit.Font | undefined;

/** Capital letters stand this tall on the 64-unit square, and the monogram at most this wide. */
const CAP_HEIGHT = 21.94;
const MAX_WIDTH = 40;
/** Space added between letters, in font units (a thousandth of the type size): set a little tight. */
const TRACKING = -30;

const monograms = new Map<string, string>();

/** The initials as one SVG path on the 64-unit square, centred on their capital height. */
function monogramPath(initials: string): string {
	let d = monograms.get(initials);
	if (d === undefined) {
		font ??= fontkit.create(fs.readFileSync(require.resolve(FONT_FILE)));
		const run = font.layout(initials);
		const width = run.bbox.maxX - run.bbox.minX + TRACKING * (run.glyphs.length - 1);
		const scale = Math.min(CAP_HEIGHT / font.capHeight, width > 0 ? MAX_WIDTH / width : Infinity);
		const left = 32 - (width * scale) / 2 - run.bbox.minX * scale;
		const baseline = 32 + (font.capHeight * scale) / 2;
		let x = 0;
		d = run.glyphs
			.map((glyph, i) => {
				const position = run.positions[i];
				const path = glyph.path
					.transform(
						scale,
						0,
						0,
						-scale,
						left + (x + position.xOffset) * scale,
						baseline - position.yOffset * scale
					)
					.toSVG();
				x += position.xAdvance + TRACKING;
				return path;
			})
			.join('')
			.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 100) / 100));
		monograms.set(initials, d);
	}
	return d;
}

/** The initials the icons show now. */
export function iconInitials() {
	return siteInitials(getSettings().siteTitle);
}

/**
 * The favicon has rounded corners of its own. The PNGs fill the square, because iOS and Android
 * round or mask Home Screen icons themselves.
 */
export function iconSvg(theme: Theme, rounded: boolean): string {
	const { colors } = theme;
	// Theme colours are checked against a strict pattern when themes load (no quotes or brackets).
	const bg = colors['bg-elevated'] ?? colors.bg ?? '#ffffff';
	const text = colors.text ?? '#000000';
	const frame = colors.highlight
		? `stroke="${colors.highlight}" stroke-opacity="0.7"`
		: `stroke="${text}" stroke-opacity="0.3"`;
	const inset = rounded ? 4 : 5;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
		`<rect width="64" height="64" rx="${rounded ? 12 : 0}" fill="${bg}"/>` +
		`<rect x="${inset}" y="${inset}" width="${64 - inset * 2}" height="${64 - inset * 2}" rx="${rounded ? 9 : 8}" fill="none" ${frame} stroke-width="1"/>` +
		`<path fill="${text}" d="${monogramPath(iconInitials())}"/>` +
		`</svg>`
	);
}

const pngs = new Map<string, Promise<Buffer>>();

export function iconPng(theme: Theme, size: number): Promise<Buffer> {
	const key = `${theme.id}:${themeVersion()}:${iconInitials()}:${size}`;
	let png = pngs.get(key);
	if (!png) {
		// Old versions of a theme are never asked for again once pages reload, so start afresh.
		if (pngs.size > 60) pngs.clear();
		png = sharp(Buffer.from(iconSvg(theme, false)), { density: (72 * size) / 64 })
			.resize(size, size)
			.flatten({ background: theme.colors.bg ?? '#ffffff' })
			.png()
			.toBuffer();
		png.catch(() => pngs.delete(key));
		pngs.set(key, png);
	}
	return png;
}
