import { get } from '#lib/server/db.js';

export function GET() {
	get('SELECT 1');
	return new Response('ok', { headers: { 'cache-control': 'no-store' } });
}
