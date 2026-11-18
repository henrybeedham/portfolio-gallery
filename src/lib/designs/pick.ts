import { page } from '$app/state';
import { DEFAULT_DESIGN } from './index.js';

/**
 * The current design's version of a slot component, or `fallback` (the Editorial one). `modules`
 * is the slot's `import.meta.glob('/src/lib/designs/*\/<Slot>.svelte', …)`. Call it inside
 * `$derived` so the component swaps when the design changes.
 */
export function pick<T>(modules: Record<string, T>, slot: string, fallback: T): T {
	const design = page.data?.design ?? DEFAULT_DESIGN;
	return modules[`/src/lib/designs/${design}/${slot}.svelte`] ?? fallback;
}
