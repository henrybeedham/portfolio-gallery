import { error } from '@sveltejs/kit';
import { serveFile } from '#lib/server/files.js';
import { heroPath } from '#lib/server/images.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request }) => {
	if (params.size !== 'large' && params.size !== 'small') error(404, 'Not found');
	const response = await serveFile(request, heroPath(params.size), {
		type: 'image/webp',
		cacheControl: 'public, max-age=31536000, immutable'
	});
	if (!response) error(404, 'Not found');
	return response;
};
