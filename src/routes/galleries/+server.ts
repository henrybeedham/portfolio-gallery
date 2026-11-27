import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The galleries page was folded into the homepage; keep old links and bookmarks working.
export const GET: RequestHandler = () => redirect(301, '/#work');
