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
	tags: number[];
}

export interface PhotoDetail extends PhotoItem {
	size: number;
	takenAt: string | null;
	camera: string | null;
	lens: string | null;
	focalLength: number | null;
	aperture: number | null;
	exposureTime: number | null;
	iso: number | null;
}

export interface AdminPhoto extends PhotoItem {
	size: number;
	downloads: number;
	takenAt: string | null;
	createdAt: string;
}

export interface Tag {
	id: number;
	name: string;
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

export interface PublicAlbum {
	id: number;
	slug: string;
	title: string;
	albumDate: string | null;
	expiresAt: string | null;
	layout: Layout;
	sortOrder: SortOrder;
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
	view: ViewQuery;
	photos: PhotoItem[];
	total: number;
	albumCount: number;
	albumBytes: number;
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
}

/* ------------------------------------------------------------ jobs & invoices */

/** “Mine” in the old spreadsheet: yes → confirmed, maybe → tentative, no → cancelled. */
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
	/** Short name shown in pickers, e.g. “AU”. */
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

export interface InvoiceRef {
	id: number;
	number: string;
	total: number;
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
	status: BookingStatus;
	shot: boolean;
	delivered: boolean;
	notes: string;
	/** Money lives on invoices only; this is the sum of the job's invoices, drafts included. */
	total: number;
	invoices: InvoiceRef[];
	albums: AlbumRef[];
	payment: PaymentState;
	upcoming: boolean;
}

export interface InvoiceSummary {
	id: number;
	number: string;
	bookingId: number | null;
	bookingTitle: string | null;
	billToName: string;
	issueDate: string;
	dueDate: string | null;
	total: number;
	paidAt: string | null;
	state: InvoiceState;
	imported: boolean;
	style: string;
}
