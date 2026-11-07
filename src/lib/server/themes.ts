/**
 * Colour themes, defined as JSON files.
 *
 * Built-in themes live in src/lib/themes/*.json and are bundled with the app. Extra themes can be
 * dropped into DATA_DIR/themes/*.json on the server without rebuilding; they are picked up within a
 * few seconds. A file in DATA_DIR/themes with the same name as a built-in theme replaces it.
 *
 * See src/lib/themes/README.md for the format.
 */
import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from './config.js';
import type { ThemeSummary } from '#lib/types.js';

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

export const DEFAULT_THEME = 'light';
export const customThemesDir = path.join(dataDir, 'themes');

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const KEY = /^[a-z][a-z0-9-]{0,39}$/;
/** Colours end up inside a <style> element, so anything that could close a rule or tag is rejected. */
const VALUE = /^[#a-zA-Z0-9(),.%\s/-]{1,80}$/;

const builtInFiles = import.meta.glob<ThemeFile>('../themes/*.json', {
	eager: true,
	import: 'default'
});

function str(value: unknown, max = 200) {
	return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function colorMap(value: unknown, source: string): Record<string, string> {
	const out: Record<string, string> = {};
	if (!value || typeof value !== 'object') return out;
	for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
		const color = typeof raw === 'string' ? raw.trim() : '';
		if (!KEY.test(key) || !VALUE.test(color) || color.includes('/*')) {
			console.warn(`[gallery] Theme ${source}: ignoring colour "${key}"`);
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

let cache: { stamp: string; themes: Theme[]; css: string } | undefined;
let checkedAt = 0;

function current() {
	const now = Date.now();
	if (!cache || now - checkedAt > 3000) {
		checkedAt = now;
		const stamp = customStamp();
		if (!cache || cache.stamp !== stamp) {
			const themes = build();
			cache = { stamp, themes, css: buildCss(themes) };
		}
	}
	return cache;
}

export function listThemes(): Theme[] {
	return current().themes;
}

export function themeSummaries(): ThemeSummary[] {
	return listThemes().map(({ id, name, description, icon, scheme, swatch }) => ({
		id,
		name,
		description,
		icon,
		scheme,
		swatch
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

/** CSS custom properties for every theme, switched by `data-theme` on <html>. */
export function themeCss(): string {
	return current().css;
}
