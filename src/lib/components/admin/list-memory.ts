/**
 * Remembers each list's filter and search (e.g. ?show=unpaid&q=boxing) so “← Jobs”, “← Invoices” and “← Galleries” go back to the view
 * you left, even after opening several jobs or reloading. Kept per browser tab.
 */
export type ListName = 'jobs' | 'invoices' | 'galleries';

const PATHS: Record<ListName, string> = {
	jobs: '/admin/jobs',
	invoices: '/admin/invoices',
	galleries: '/admin/albums'
};

/** A filter chip's link: `?show=` (left off for the default) with the current search kept. */
export function chipHref(path: string, show: string | null, query: string): string {
	const params = new URLSearchParams();
	if (show) params.set('show', show);
	if (query.trim()) params.set('q', query.trim());
	const search = params.toString();
	return search ? `${path}?${search}` : path;
}
const memory: Partial<Record<ListName, string>> = {};

/** Call from the list page whenever its URL changes. Client-side only. */
export function rememberList(list: ListName, search: string) {
	memory[list] = search;
	try {
		sessionStorage.setItem(`admin-list:${list}`, search);
	} catch {
		// storage unavailable; the in-memory copy still works for this visit
	}
}

/** The list's URL with the filter last used in this tab. Client-side only. */
export function listUrl(list: ListName): string {
	let search = memory[list];
	if (search === undefined) {
		try {
			search = sessionStorage.getItem(`admin-list:${list}`) ?? '';
		} catch {
			search = '';
		}
	}
	return PATHS[list] + search;
}

export function listPath(list: ListName) {
	return PATHS[list];
}
