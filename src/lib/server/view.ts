import { SORT_ORDERS, type SortOrder, type Tag, type ViewQuery } from '#lib/types.js';
import type { Album } from './albums.js';
import { randomSeed } from './photos.js';

/** Reads the visitor's tag filter and sort order from the URL, falling back to the album defaults. */
export function parseView(url: URL, album: Album, tags: Tag[]): ViewQuery {
	const sortParam = url.searchParams.get('sort') as SortOrder | null;
	const sort = sortParam && SORT_ORDERS.includes(sortParam) ? sortParam : album.sortOrder;
	const tagParam = Number(url.searchParams.get('tag'));
	const tag = tagParam && tags.some((t) => t.id === tagParam) ? tagParam : null;
	const seedParam = Math.floor(Number(url.searchParams.get('seed')));
	const seed = sort === 'random' ? (seedParam > 0 ? seedParam : randomSeed()) : null;
	return { sort, tag, seed };
}
