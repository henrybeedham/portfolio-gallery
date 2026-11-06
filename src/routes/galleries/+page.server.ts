import { listPublicAlbums } from '#lib/server/albums.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	return { albums: listPublicAlbums('galleries') };
};
