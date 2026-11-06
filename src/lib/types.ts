export type Layout = 'grid' | 'masonry';
export type SortOrder = 'oldest' | 'newest' | 'random';
export type AdminSort = SortOrder | 'downloads' | 'name';
export type Theme = 'light' | 'dark';

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
	defaultAccentColor: string;
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
	count: number;
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
	accentColor: string;
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
	accentColor: string;
	layout: Layout;
	sortOrder: SortOrder;
}
