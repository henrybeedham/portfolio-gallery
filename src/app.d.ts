// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			isAdmin: boolean;
		}
		// interface PageData {}
		interface PageState {
			/** Id of the photo shown in the album lightbox (shallow routing). */
			lightbox?: number;
		}
		// interface Platform {}
	}
}

export {};
