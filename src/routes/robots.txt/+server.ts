import type { RequestHandler } from './$types';

// Albums that aren't on the homepage say `noindex` themselves (`isIndexable`), so they aren't listed
// here: robots.txt is public, and naming them would give their addresses away.
export const GET: RequestHandler = ({ url }) =>
	new Response(
		[
			'User-agent: *',
			'Disallow: /admin',
			'Disallow: /api/',
			'',
			`Sitemap: ${url.origin}/sitemap.xml`,
			''
		].join('\n'),
		{
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'cache-control': 'public, max-age=3600'
			}
		}
	);
