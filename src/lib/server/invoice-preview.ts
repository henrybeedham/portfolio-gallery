import crypto from 'node:crypto';

/**
 * Rendered previews are kept briefly and served from a normal URL. Loading a PDF from a blob: URL
 * inside the editor would inherit the admin page's Content-Security-Policy (object-src 'none'),
 * which stops browsers' built-in PDF viewers.
 */
const previews = new Map<string, { pdf: Buffer; expires: number }>();
const TTL = 5 * 60_000;
const MAX = 40;

export function storePreview(pdf: Buffer): string {
	const now = Date.now();
	for (const [key, entry] of previews) if (entry.expires < now) previews.delete(key);
	while (previews.size >= MAX) previews.delete(previews.keys().next().value!);
	const token = crypto.randomBytes(16).toString('hex');
	previews.set(token, { pdf, expires: now + TTL });
	return token;
}

export function getPreview(token: string): Buffer | undefined {
	const entry = previews.get(token);
	if (!entry || entry.expires < Date.now()) return undefined;
	return entry.pdf;
}
