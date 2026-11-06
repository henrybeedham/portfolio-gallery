const buckets = new Map<string, { count: number; reset: number }>();

/** Returns false once `key` has been seen more than `limit` times within `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();
	if (buckets.size > 10_000) {
		for (const [k, bucket] of buckets) if (bucket.reset < now) buckets.delete(k);
	}
	const bucket = buckets.get(key);
	if (!bucket || bucket.reset < now) {
		buckets.set(key, { count: 1, reset: now + windowMs });
		return true;
	}
	bucket.count++;
	return bucket.count <= limit;
}

export function clientIp(event: { getClientAddress: () => string }) {
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown';
	}
}
