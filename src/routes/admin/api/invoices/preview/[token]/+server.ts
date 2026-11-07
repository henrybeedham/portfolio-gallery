import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard.js';
import { getPreview } from '#lib/server/invoice-preview.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, locals }) => {
	requireAdmin(locals);
	const pdf = getPreview(params.token);
	if (!pdf) error(404, 'Preview expired');
	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': 'inline; filename="Invoice preview.pdf"',
			'cache-control': 'private, max-age=300'
		}
	});
};
