// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			isAdmin: boolean;
			/** Theme id for `<html data-theme>`, when a page shows something other than the site theme. */
			theme?: string;
		}
		interface PageData {
			/** The site theme from the root layout, replaced by an album's own theme on album pages. */
			theme: import('#lib/types.js').PageTheme;
		}
		interface PageState {
			/** Id of the photo shown in the album lightbox (shallow routing). */
			lightbox?: number;
		}
		// interface Platform {}
	}
}

export {};
