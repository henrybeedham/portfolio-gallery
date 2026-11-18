/**
 * Site designs: layout, typography and component structure. Separate from themes, which only set
 * colours, so any design can be combined with any theme.
 *
 * Each design lives in `src/lib/designs/<id>/`:
 * - `index.ts` (optional) is imported on every page; it imports the design's fonts and CSS. All CSS
 *   must be scoped under `:root[data-design='<id>']`.
 * - `<Slot>.svelte` files replace the component of the same name (see `SLOTS`). A design that
 *   doesn't provide a slot falls back to the Editorial version.
 */
export const DESIGNS = [
	{
		id: 'editorial',
		name: 'Editorial',
		description: 'Serif headlines, paper tones and hairlines.'
	},
	{ id: 'index', name: 'Index', description: 'Swiss grid, grotesk type and numbered indexes.' },
	{ id: 'cinema', name: 'Cinema', description: 'Full-bleed images and condensed titles.' },
	{ id: 'studio', name: 'Studio', description: 'Soft, rounded and friendly.' },
	{ id: 'contact-sheet', name: 'Contact Sheet', description: 'Film frames and darkroom type.' },
	{ id: 'monograph', name: 'Monograph', description: 'A centred, classical photobook.' }
] as const;

export type DesignId = (typeof DESIGNS)[number]['id'];

export const DEFAULT_DESIGN: DesignId = 'editorial';

/** Set by `?design=<id>` to preview a design while browsing; cleared when Settings are saved. */
export const DESIGN_PREVIEW_COOKIE = 'design-preview';

export function isDesign(value: unknown): value is DesignId {
	return DESIGNS.some((design) => design.id === value);
}

/**
 * Components a design can replace, by file name. Public: SiteHeader, SiteFooter, Home, Galleries,
 * AlbumCard, AlbumView, PhotoGallery, Lightbox, PasswordGate, ExpiredNotice, ErrorPage.
 * Admin: AdminShell, AdminDashboard, AdminLogin.
 */
export const SLOTS = [
	'SiteHeader',
	'SiteFooter',
	'Home',
	'Galleries',
	'AlbumCard',
	'AlbumView',
	'PhotoGallery',
	'Lightbox',
	'PasswordGate',
	'ExpiredNotice',
	'ErrorPage',
	'AdminShell',
	'AdminDashboard',
	'AdminLogin'
] as const;
