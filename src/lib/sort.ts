import type { AdminPhoto, AdminSort } from './types.js';

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Deterministic Fisher–Yates shuffle, so paginated random orders stay stable for a given seed. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
	const random = mulberry32(seed);
	const result = items.slice();
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export function sortAdminPhotos(photos: AdminPhoto[], sort: AdminSort, seed = 1): AdminPhoto[] {
	const list = photos.slice();
	const chrono = (p: AdminPhoto) => p.takenAt ?? p.createdAt;
	switch (sort) {
		case 'newest':
			return list.sort((a, b) => chrono(b).localeCompare(chrono(a)) || b.id - a.id);
		case 'downloads':
			return list.sort((a, b) => b.downloads - a.downloads || a.id - b.id);
		case 'name':
			return list.sort((a, b) =>
				a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
			);
		case 'random':
			return seededShuffle(list, seed);
		default:
			return list.sort((a, b) => chrono(a).localeCompare(chrono(b)) || a.id - b.id);
	}
}
