export type Layout = 'grid' | 'masonry';
export type SortOrder = 'oldest' | 'newest' | 'random';
export type AdminSort = SortOrder | 'downloads' | 'name';
/** Id of a theme in src/lib/themes or DATA_DIR/themes (the file name without .json). */
export type Theme = string;

/** What the theme pickers need to know about a theme. */
export interface ThemeSummary {
	id: string;
	name: string;
	description: string;
	/** Icon name, see ThemeIcon.svelte. */
	icon: string;
	scheme: 'light' | 'dark';
	swatch: { bg: string; surface: string; text: string; border: string; accent: string };
	/** Bundled with the app, uploaded, or uploaded with the same name as a bundled theme. */
	source: 'built-in' | 'custom' | 'replaced';
}

/** The theme a page is shown in. */
export interface PageTheme {
	id: string;
	/** For `<meta name="theme-color">`. */
	color: string;
	/** Changes whenever the theme CSS does. */
	version: string;
	/** The browser-tab and Home Screen icons, drawn in this theme's colours. */
	icons: { favicon: string; touch: string };
}

export const LAYOUTS: Layout[] = ['grid', 'masonry'];
export const SORT_ORDERS: SortOrder[] = ['oldest', 'newest', 'random'];

export interface SiteSettings {
	siteTitle: string;
	copyright: string;
	heroTitle: string;
	heroDescription: string;
	heroImage: string | null;
	galleriesIntro: string;
	aboutTitle: string;
	aboutText: string;
	contactEmail: string;
	contactPhone: string;
	showContactOnHome: boolean;
	discordWebhook: string;
	theme: Theme;
	defaultDescription: string;
	/** Theme for new albums, or '' to follow the site's theme. */
	defaultAlbumTheme: Theme;
	defaultLayout: Layout;
	defaultSort: SortOrder;
	defaultPublic: boolean;
	defaultShowOnHome: boolean;
	defaultShowOnGalleries: boolean;
}

export type PublicSettings = Omit<SiteSettings, 'discordWebhook'>;

export interface ImageRef {
	key: string;
	v: number;
	w: number;
	h: number;
}

export interface PhotoItem extends ImageRef {
	id: number;
	name: string;
	/** Set for videos, whose thumbnails come from a poster frame. */
	kind?: 'video';
	/** Seconds, for videos. */
	duration?: number | null;
	/** Set for videos with a smaller copy for playing in the browser; downloads get the original. */
	preview?: true;
	/** The album section the photo is in, if any. */
	section?: number;
}

export interface AdminPhoto extends PhotoItem {
	tags: number[];
	size: number;
	downloads: number;
	takenAt: string | null;
	createdAt: string;
}

export interface Tag {
	id: number;
	name: string;
}

/** A named part of an album, such as “Day 1 — Film”. Photos without one come first. */
export interface Section {
	id: number;
	title: string;
	/** Plain text, shown under the heading. */
	description: string;
}

export interface AdminSection extends Section {
	count: number;
}

/** A section as it appears in the visitor's current view (tag filter and sort). */
export interface ViewSection extends Section {
	/** Photos in the section in this view. */
	count: number;
	/** Where the section's first photo sits in the view, for jumping to it. */
	start: number;
	/** Its first few photos, shown small while the section is collapsed. */
	preview: PhotoItem[];
}

export interface AlbumCardData {
	id: number;
	slug: string;
	title: string;
	/** Null on public listings of password-protected albums. */
	count: number | null;
	date: string | null;
	locked: boolean;
	cover: ImageRef | null;
}

export interface JobStatus {
	id: string;
	kind: string;
	label: string;
	total: number;
	done: number;
	failed: number;
	status: 'running' | 'done' | 'error';
	message: string | null;
}

export interface ViewQuery {
	sort: SortOrder;
	tag: number | null;
	seed: number | null;
}

interface PublicAlbum {
	id: number;
	slug: string;
	title: string;
	albumDate: string | null;
	expiresAt: string | null;
	layout: Layout;
	sortOrder: SortOrder;
	sectionsCollapsed: boolean;
	hasPassword: boolean;
	isPublic: boolean;
}

export interface AlbumViewData {
	album: PublicAlbum;
	settings: PublicSettings;
	isAdmin: boolean;
	preview: boolean;
	expired: boolean;
	descriptionHtml: string;
	tags: Tag[];
	sections: ViewSection[];
	view: ViewQuery;
	photos: PhotoItem[];
	total: number;
	albumCount: number;
	background: ImageRef | null;
}

export interface AlbumFormInitial {
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
	/** Theme id, or '' to follow the site's theme. */
	theme: Theme;
	layout: Layout;
	sortOrder: SortOrder;
	sectionsCollapsed: boolean;
}

/* ------------------------------------------------------------ jobs & invoices */

export type BookingStatus = 'confirmed' | 'tentative' | 'cancelled';
export const BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'tentative', 'cancelled'];

/**
 * A job's payment state, from its invoices. Drafts don't count as invoiced until they're issued, so a
 * job with only drafts is “draft”, and one with none is “not-invoiced”.
 */
export type PaymentState = 'paid' | 'part-paid' | 'unpaid' | 'overdue' | 'draft' | 'not-invoiced';

/** A draft hasn't been sent yet; it holds the fee you expect, and is dated when it's issued. */
export type InvoiceState = 'draft' | 'paid' | 'unpaid' | 'overdue';

export interface BillingAddress {
	id: number;
	/** Short name shown in pickers, e.g. “Acme”. */
	label: string;
	organisation: string;
	/** The lines under the organisation, one per line. */
	address: string;
}

export interface InvoiceSender {
	name: string;
	address: string;
	phone: string;
	email: string;
}

export interface InvoiceSettings {
	sender: InvoiceSender;
	paymentDetails: string;
	notes: string;
	itemDescription: string;
	/** Pence per hour. */
	hourlyRate: number;
	/** Theme id used for new invoices. */
	style: string;
	/** Due date for new invoices when there's no upcoming shoot date to use. */
	paymentTermsDays: number;
	/** Make new invoices due on the job's shoot date when it's still ahead. */
	dueOnShootDate: boolean;
}

export interface InvoiceItem {
	description: string;
	quantity: number;
	/** Pence per unit. */
	rate: number;
}

/** Everything printed on an invoice. */
export interface InvoiceDocument {
	number: string;
	issueDate: string;
	dueDate: string | null;
	billToName: string;
	billToAddress: string;
	sender: InvoiceSender;
	paymentDetails: string;
	notes: string;
	items: InvoiceItem[];
	style: string;
	paidAt: string | null;
}

export interface JobRef {
	id: number;
	title: string;
}

/** An invoice as seen from one of its jobs. */
export interface InvoiceRef {
	id: number;
	number: string;
	total: number;
	/** How much of the total counts towards this job; all of it unless the invoice is shared. */
	share: number;
	/** The invoice's other jobs. */
	sharedWith: JobRef[];
	paidAt: string | null;
	dueDate: string | null;
	state: InvoiceState;
	/** Converted from a job's old fee, paid tick or earlier invoice numbers; there's no PDF. */
	imported: boolean;
}

export interface AlbumRef {
	id: number;
	title: string;
	slug: string;
}

/** A photography job as shown in the admin. */
export interface Booking {
	id: number;
	title: string;
	/** Client name (a society, business or person), printed in bold on invoices. */
	client: string;
	billingAddressId: number | null;
	billingLabel: string | null;
	location: string;
	/** Naive local date and time, YYYY-MM-DDTHH:mm (or just the date). */
	startsAt: string | null;
	/** Naive local date and time, set only when the start has a time too. */
	endsAt: string | null;
	status: BookingStatus;
	delivered: boolean;
	notes: string;
	/** Money lives on invoices only; this is the job's share of its invoices, drafts included. */
	total: number;
	invoices: InvoiceRef[];
	albums: AlbumRef[];
	payment: PaymentState;
	upcoming: boolean;
}

export interface InvoiceSummary {
	id: number;
	number: string;
	jobs: JobRef[];
	billToName: string;
	issueDate: string;
	dueDate: string | null;
	total: number;
	paidAt: string | null;
	state: InvoiceState;
	imported: boolean;
	style: string;
}

/** One thing the admin ⌘K search can find. */
export interface SearchEntry {
	kind: 'gallery' | 'job' | 'invoice' | 'client';
	title: string;
	detail: string;
	href: string;
	/** Extra text to match on that isn't shown. */
	keywords: string;
}

/* ---------------------------------------------------------------- widgets */

/** A colour as a hex value and an opacity, which is what Scriptable's `new Color()` takes. */
/** For the Scriptable widgets (widget.ts, scriptable/Gallery.js) and their previews. */
export type WidgetColor = [hex: string, alpha: number];

export interface WidgetColors {
	bg: WidgetColor;
	surface: WidgetColor;
	text: WidgetColor;
	muted: WidgetColor;
	subtle: WidgetColor;
	border: WidgetColor;
	highlight: WidgetColor;
	danger: WidgetColor;
	warning: WidgetColor;
	success: WidgetColor;
}

export interface WidgetJob {
	title: string;
	client: string;
	location: string;
	/** “Sat 22 Nov”. */
	day: string;
	/** For the date blocks in job lists: “Sat” and “22”. */
	weekday: string;
	date: string;
	time: string;
	/** 0 for today, 1 for tomorrow… */
	daysUntil: number;
	when: string;
	tentative: boolean;
	url: string;
}

export interface WidgetTask {
	label: string;
	detail: string;
	kind: 'overdue' | 'deliver' | 'invoice';
	url: string;
}

export interface WidgetData {
	site: { title: string; url: string };
	generatedAt: string;
	theme: string;
	scheme: 'light' | 'dark';
	themes: Record<string, { name: string; scheme: 'light' | 'dark'; colors: WidgetColors }>;
	jobs: WidgetJob[];
	money: {
		outstanding: string;
		unpaidCount: number;
		overdue: string;
		overdueCount: number;
		paidThisMonth: string;
		paidThisMonthCount: number;
		paidThisTaxYear: string;
		taxYear: string;
		url: string;
	};
	activity: {
		views: number;
		downloads: number;
		previousViews: number;
		previousDownloads: number;
		/** The last 14 days, oldest first. */
		daily: { day: string; views: number; downloads: number }[];
		top: { title: string; views: number; downloads: number }[];
		url: string;
	};
	todo: { count: number; tasks: WidgetTask[]; url: string };
}

export type WidgetKind = 'overview' | 'jobs' | 'money' | 'activity' | 'todo';
/** Home Screen sizes, then the Lock Screen's rectangular, circular and inline widgets. */
export type WidgetFamily = 'small' | 'medium' | 'large' | 'rectangular' | 'circular' | 'inline';
