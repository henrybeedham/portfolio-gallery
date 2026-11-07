/**
 * Remembers each list's filter (e.g. ?show=unpaid) so “← Jobs” and “← Invoices” go back to the view
 * you left, even after opening several jobs or reloading. Kept per browser tab.
 */
export type ListName = 'jobs' | 'invoices';

const PATHS: Record<ListName, string> = { jobs: '/admin/jobs', invoices: '/admin/invoices' };
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
