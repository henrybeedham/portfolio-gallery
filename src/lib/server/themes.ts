/**
 * Colour themes, defined as JSON files.
 *
 * Built-in themes live in src/lib/themes/*.json and are bundled with the app. Extra themes can be
 * dropped into DATA_DIR/themes/*.json on the server without rebuilding; they are picked up within a
 * few seconds. A file in DATA_DIR/themes with the same name as a built-in theme replaces it.
 *
 * See src/lib/themes/README.md for the format.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './config.js';
import { getSettings } from './settings.js';
import type { PageTheme, ThemeSummary } from '#lib/types.js';
import { siteInitials } from '#lib/utils.js';

interface ThemeFile {
	name?: unknown;
	description?: unknown;
	icon?: unknown;
	scheme?: unknown;
	order?: unknown;
	extends?: unknown;
	colors?: unknown;
	invoice?: unknown;
}

export interface Theme extends ThemeSummary {
	order: number;
	builtIn: boolean;
	/** Every colour, keyed by CSS custom property name without the leading dashes. */
	colors: Record<string, string>;
	/** The colours used on PDF invoices: `colors` with the theme's invoice overrides applied. */
	invoice: Record<string, string>;
}

const DEFAULT_THEME = 'light';
export const customThemesDir = path.join(dataDir, 'themes');

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const KEY = /^[a-z][a-z0-9-]{0,39}$/;
/** Colours end up inside a <style> element, so anything that could close a rule or tag is rejected. */
const VALUE = /^[#a-zA-Z0-9(),.%\s/-]{1,80}$/;

const builtInFiles = import.meta.glob<ThemeFile>('../themes/*.json', {
	eager: true,
	import: 'default'
});
const builtInIds = new Set(Object.keys(builtInFiles).map((file) => path.basename(file, '.json')));

function str(value: unknown, max = 200) {
	return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Reads a colour map, skipping anything unsafe. Skipped keys are logged, or collected in `problems`. */
function colorMap(value: unknown, source: string, problems?: string[]): Record<string, string> {
	const out: Record<string, string> = {};
	if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
	for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
		const color = typeof raw === 'string' ? raw.trim() : '';
		// url() would let a theme make visitors' browsers fetch from another site.
		if (!KEY.test(key) || !VALUE.test(color) || color.includes('/*') || /url\s*\(/i.test(color)) {
			if (problems) problems.push(`${source}: “${key}” was skipped (not a valid colour).`);
			else console.warn(`[gallery] Theme ${source}: ignoring colour "${key}"`);
			continue;
		}
		out[key] = color;
	}
	return out;
}

function readCustomFiles(): Map<string, ThemeFile> {
	const files = new Map<string, ThemeFile>();
	let names: string[];
	try {
		names = fs.readdirSync(customThemesDir).filter((name) => name.endsWith('.json'));
	} catch {
		return files;
	}
	for (const name of names) {
		const id = name.slice(0, -5).toLowerCase();
		if (!ID.test(id)) {
			console.warn(
				`[gallery] Theme file "${name}" ignored: use lowercase letters, numbers and hyphens.`
			);
			continue;
		}
		try {
			files.set(id, JSON.parse(fs.readFileSync(path.join(customThemesDir, name), 'utf8')));
		} catch (error) {
			console.warn(`[gallery] Theme file "${name}" ignored: ${(error as Error).message}`);
		}
	}
	return files;
}

/** Changes whenever a custom theme file is added, removed or edited. */
function customStamp(): string {
	try {
		return fs
			.readdirSync(customThemesDir)
			.filter((name) => name.endsWith('.json'))
			.map((name) => `${name}:${fs.statSync(path.join(customThemesDir, name)).mtimeMs}`)
			.join('|');
	} catch {
		return '';
	}
}

function build(): Theme[] {
	const raw = new Map<string, { file: ThemeFile; builtIn: boolean }>();
	for (const [file, theme] of Object.entries(builtInFiles)) {
		const id = path.basename(file, '.json');
		if (ID.test(id)) raw.set(id, { file: theme, builtIn: true });
	}
	for (const [id, file] of readCustomFiles()) raw.set(id, { file, builtIn: false });

	const resolved = new Map<string, Theme>();
	const invoiceOverrides = new Map<string, Record<string, string>>();

	function resolve(id: string, trail: string[] = []): Theme | undefined {
		const done = resolved.get(id);
		if (done) return done;
		const entry = raw.get(id);
		if (!entry || trail.includes(id)) return undefined;
		const { file, builtIn } = entry;
		const scheme = file.scheme === 'dark' ? 'dark' : 'light';

		// Start from the parent theme, or from the built-in theme with the same scheme so a partial
		// file never leaves the site without colours.
		const parentId = str(file.extends) || (scheme === 'dark' ? 'dark' : DEFAULT_THEME);
		const parent = parentId !== id ? resolve(parentId, [...trail, id]) : undefined;

		const colors = { ...parent?.colors, ...colorMap(file.colors, id) };
		// Invoice overrides are inherited only through an explicit `extends`.
		const overrides = {
			...(file.extends && parent ? invoiceOverrides.get(parent.id) : undefined),
			...colorMap(file.invoice, `${id} (invoice)`)
		};
		invoiceOverrides.set(id, overrides);
		const accent = colors.highlight ?? colors.accent ?? colors.text ?? '#000000';

		const theme: Theme = {
			id,
			name: str(file.name, 40) || id.charAt(0).toUpperCase() + id.slice(1),
			description: str(file.description),
			icon: str(file.icon, 20) || 'palette',
			scheme,
			order: typeof file.order === 'number' ? file.order : 100,
			builtIn,
			source: builtIn ? 'built-in' : builtInIds.has(id) ? 'replaced' : 'custom',
			colors,
			invoice: { ...colors, ...overrides },
			swatch: {
				bg: colors.bg ?? '#ffffff',
				surface: colors['bg-elevated'] ?? colors.bg ?? '#ffffff',
				text: colors.text ?? '#000000',
				border: colors.border ?? '#cccccc',
				accent
			}
		};
		resolved.set(id, theme);
		return theme;
	}

	for (const id of raw.keys()) resolve(id);
	return [...resolved.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function buildCss(themes: Theme[]): string {
	// A colour that only some themes define (like "highlight") is reset to `initial` in the others, so
	// `var(--highlight, var(--text))` falls back correctly whichever theme was active before.
	const keys = [...new Set(themes.flatMap((theme) => Object.keys(theme.colors)))].sort();
	const block = (theme: Theme) =>
		keys.map((key) => `--${key}:${theme.colors[key] ?? 'initial'}`).join(';') +
		`;color-scheme:${theme.scheme}`;
	const fallback = themes.find((theme) => theme.id === DEFAULT_THEME) ?? themes[0];
	const rules = themes.map((theme) => `[data-theme='${theme.id}']{${block(theme)}}`);
	if (fallback) rules.unshift(`:root{${block(fallback)}}`);
	return rules.join('\n');
}

let cache: { stamp: string; themes: Theme[]; css: string; version: string } | undefined;
let checkedAt = 0;

function current() {
	const now = Date.now();
	if (!cache || now - checkedAt > 3000) {
		checkedAt = now;
		const stamp = customStamp();
		if (!cache || cache.stamp !== stamp) {
			const themes = build();
			const css = buildCss(themes);
			const version = crypto.createHash('sha1').update(css).digest('hex').slice(0, 10);
			cache = { stamp, themes, css, version };
		}
	}
	return cache;
}

export function listThemes(): Theme[] {
	return current().themes;
}

export function themeSummaries(): ThemeSummary[] {
	return listThemes().map(({ id, name, description, icon, scheme, swatch, source }) => ({
		id,
		name,
		description,
		icon,
		scheme,
		swatch,
		source
	}));
}

export function getTheme(id: string | null | undefined): Theme {
	const themes = listThemes();
	return (
		themes.find((theme) => theme.id === id) ??
		themes.find((theme) => theme.id === DEFAULT_THEME) ??
		themes[0]
	);
}

export function hasTheme(id: string): boolean {
	return listThemes().some((theme) => theme.id === id);
}

/** The site icons, drawn in a theme's colours by site-icon.ts and served from /site/icon. */
export const ICON_FILES = ['favicon.svg', '180.png', '192.png', '512.png'] as const;
export type IconFile = (typeof ICON_FILES)[number];

/** Changes whenever the icons would look different: new colours, or new initials in the site title. */
export function iconVersion(): string {
	return `${themeVersion()}-${siteInitials(getSettings().siteTitle)}`;
}

/** The URL of a theme's icon, versioned so browsers fetch it again when it changes. */
export function iconUrl(id: string | null | undefined, file: IconFile): string {
	return `/site/icon/${getTheme(id).id}/${file}?v=${iconVersion()}`;
}

/** What a page needs to show a theme: the `data-theme` id, the browser UI colour and the CSS version. */
export function pageTheme(id: string | null | undefined): PageTheme {
	const theme = getTheme(id);
	return {
		id: theme.id,
		color: theme.swatch.bg,
		version: themeVersion(),
		icons: { favicon: iconUrl(theme.id, 'favicon.svg'), touch: iconUrl(theme.id, '180.png') }
	};
}

/**
 * Shows an album page in the album's own theme, or the site's when it has none (or its theme was
 * deleted). Return the result as the page's `theme` data: it replaces the root layout's site theme
 * in `page.data`, and `locals.theme` sets `<html data-theme>` when the page is rendered on the server.
 */
export function albumPageTheme(locals: App.Locals, album: { theme: string | null }): PageTheme {
	const theme = pageTheme(album.theme && hasTheme(album.theme) ? album.theme : getSettings().theme);
	locals.theme = theme.id;
	return theme;
}

/** CSS custom properties for every theme, switched by `data-theme` (on <html>, or any element). */
export function themeCss(): string {
	return current().css;
}

/** Changes whenever the theme CSS does, so open pages know to fetch the new CSS. */
export function themeVersion(): string {
	return current().version;
}

/** A theme's file as JSON, for downloading (uploaded themes exactly as saved). */
export function themeFileJson(id: string): string | null {
	const custom = readCustomTheme(id);
	if (custom !== null) return custom;
	const entry = Object.entries(builtInFiles).find(([file]) => path.basename(file, '.json') === id);
	return entry ? JSON.stringify(entry[1], null, '\t') + '\n' : null;
}

/* ------------------------------------------------------------ uploads */

/** Picks up added or removed theme files straight away instead of within a few seconds. */
function refreshThemes() {
	cache = undefined;
}

/** A theme id from an uploaded file's name: “My Theme.json” → “my-theme”. */
export function themeIdFromFilename(filename: string): string {
	return filename
		.replace(/\.json$/i, '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
}

type ThemeCheck = { ok: true; theme: ThemeFile; warnings: string[] } | { ok: false; error: string };

/** Checks an uploaded theme file before it's saved. */
export function checkThemeFile(text: string, id: string): ThemeCheck {
	if (!ID.test(id)) {
		return { ok: false, error: 'Name the file with letters, numbers and hyphens, e.g. plum.json.' };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		return { ok: false, error: `That isn’t valid JSON: ${(error as Error).message}` };
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return {
			ok: false,
			error: 'A theme file should be a JSON object, like the examples in the docs.'
		};
	}
	const theme = parsed as ThemeFile;
	const warnings: string[] = [];
	const colors = colorMap(theme.colors, 'colors', warnings);
	colorMap(theme.invoice, 'invoice', warnings);
	const parent = str(theme.extends);
	if (parent && !hasTheme(parent))
		warnings.push(`“extends” names a theme that doesn’t exist: ${parent}.`);
	if (parent === id) return { ok: false, error: 'A theme can’t extend itself.' };
	if (!Object.keys(colors).length && !parent) {
		return {
			ok: false,
			error: 'The file has no colours. Add a “colors” object, or “extends” another theme.'
		};
	}
	if (theme.scheme !== undefined && theme.scheme !== 'light' && theme.scheme !== 'dark') {
		warnings.push('“scheme” should be "light" or "dark"; using light.');
	}
	return { ok: true, theme, warnings };
}

export function saveCustomTheme(id: string, theme: ThemeFile) {
	fs.mkdirSync(customThemesDir, { recursive: true });
	fs.writeFileSync(
		path.join(customThemesDir, `${id}.json`),
		JSON.stringify(theme, null, '\t') + '\n'
	);
	refreshThemes();
}

/** Removes an uploaded theme. A built-in theme it replaced comes back. */
export function deleteCustomTheme(id: string): boolean {
	if (!ID.test(id)) return false;
	try {
		fs.unlinkSync(path.join(customThemesDir, `${id}.json`));
	} catch {
		return false;
	}
	refreshThemes();
	return true;
}

/** The uploaded file's contents, for downloading it again. */
function readCustomTheme(id: string): string | null {
	if (!ID.test(id)) return null;
	try {
		return fs.readFileSync(path.join(customThemesDir, `${id}.json`), 'utf8');
	} catch {
		return null;
	}
}
