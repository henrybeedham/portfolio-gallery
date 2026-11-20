import { validateSlug, type Album, type AlbumInput } from './albums.js';
import { hashPassword } from './auth.js';
import { getSettings } from './settings.js';
import { hasTheme } from './themes.js';
import { LAYOUTS, SORT_ORDERS, type Layout, type SortOrder } from '#lib/types.js';
import { slugify } from '#lib/utils.js';

const MIN_PASSWORD_LENGTH = 6;

export interface AlbumFormValues {
	title: string;
	slug: string;
	description: string;
	albumDate: string;
	isPublic: boolean;
	showOnHome: boolean;
	showOnGalleries: boolean;
	isFeatured: boolean;
	passwordEnabled: boolean;
	expiresAt: string;
	/** Theme id, or '' to use the site's theme. */
	theme: string;
	layout: Layout;
	sortOrder: SortOrder;
	sectionsCollapsed: boolean;
}

export type AlbumFormResult =
	| { ok: true; input: AlbumInput }
	| { ok: false; error: string; field?: string; values: AlbumFormValues };

function checkbox(data: FormData, name: string) {
	const value = data.get(name);
	return value === 'on' || value === 'true' || value === '1';
}

/** Parses and validates the album form for both creation and editing. */
export function parseAlbumForm(data: FormData, existing?: Album): AlbumFormResult {
	const settings = getSettings();
	const str = (name: string) => String(data.get(name) ?? '').trim();
	const has = (name: string) => data.has(name);

	const title = str('title').slice(0, 200);
	const slug = slugify(str('slug') || title);
	const layout = (LAYOUTS as string[]).includes(str('layout'))
		? (str('layout') as Layout)
		: settings.defaultLayout;
	const sortOrder = (SORT_ORDERS as string[]).includes(str('sort_order'))
		? (str('sort_order') as SortOrder)
		: settings.defaultSort;
	const theme = str('theme');
	const albumDate = /^\d{4}-\d{2}-\d{2}$/.test(str('album_date')) ? str('album_date') : '';
	let expiresAt = '';
	if (str('expires_at')) {
		const date = new Date(str('expires_at'));
		if (!isNaN(date.getTime())) expiresAt = date.toISOString();
	}

	const values: AlbumFormValues = {
		title,
		slug,
		description: String(data.get('description') ?? '').slice(0, 20_000),
		albumDate,
		isPublic: checkbox(data, 'is_public'),
		showOnHome: checkbox(data, 'show_on_home'),
		// Unchecked checkboxes aren't submitted, so the marker fields tell "off" apart from "absent".
		showOnGalleries: has('show_on_galleries_present')
			? checkbox(data, 'show_on_galleries')
			: (existing?.showOnGalleries ?? settings.defaultShowOnGalleries),
		isFeatured: has('is_featured_present')
			? checkbox(data, 'is_featured')
			: (existing?.isFeatured ?? false),
		passwordEnabled: checkbox(data, 'password_enabled'),
		expiresAt,
		theme: theme && hasTheme(theme) ? theme : '',
		layout,
		sortOrder,
		sectionsCollapsed: checkbox(data, 'sections_collapsed')
	};

	const fail = (error: string, field?: string): AlbumFormResult => ({
		ok: false,
		error,
		field,
		values
	});

	if (!title) return fail('Please give the album a title.', 'title');
	const slugError = validateSlug(slug, existing?.id);
	if (slugError) return fail(slugError, 'slug');

	let passwordHash: string | null = null;
	if (values.passwordEnabled) {
		const password = String(data.get('password') ?? '');
		if (password) {
			if (password.length < MIN_PASSWORD_LENGTH)
				return fail(`Album passwords need at least ${MIN_PASSWORD_LENGTH} characters.`, 'password');
			passwordHash = hashPassword(password);
		} else if (existing?.passwordHash) {
			passwordHash = existing.passwordHash;
		} else {
			return fail('Enter a password, or turn password protection off.', 'password');
		}
	}

	return {
		ok: true,
		input: {
			title: values.title,
			slug: values.slug,
			description: values.description,
			albumDate: values.albumDate || null,
			isPublic: values.isPublic,
			showOnHome: values.showOnHome,
			showOnGalleries: values.showOnGalleries,
			isFeatured: values.isFeatured,
			passwordHash,
			expiresAt: values.expiresAt || null,
			theme: values.theme || null,
			layout: values.layout,
			sortOrder: values.sortOrder,
			sectionsCollapsed: values.sectionsCollapsed
		}
	};
}
