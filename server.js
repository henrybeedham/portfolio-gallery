// Production entry point. Wraps the SvelteKit adapter-node handler with a few
// self-hosting conveniences:
//
//  - works both directly over http:// and behind a TLS reverse proxy (the request
//    origin is derived from X-Forwarded-Proto / X-Forwarded-Host when present),
//  - ORIGIN pins the public URL if your proxy doesn't send forwarding headers,
//  - forwarding headers are only trusted from a reverse proxy (TRUST_PROXY), so visitors
//    can't spoof the site's origin or their own IP address,
//  - large bodies are only accepted by the upload endpoints; everything else is capped,
//  - graceful shutdown on SIGTERM / SIGINT (docker stop).

import http from 'node:http';
import net from 'node:net';
import process from 'node:process';

// The client address is computed below and passed to SvelteKit in this header.
const CLIENT_IP_HEADER = 'x-gallery-client-ip';

process.env.PROTOCOL_HEADER ||= 'x-forwarded-proto';
process.env.HOST_HEADER ||= 'x-forwarded-host';
process.env.ADDRESS_HEADER = CLIENT_IP_HEADER;
process.env.BODY_SIZE_LIMIT ||= '512M';

const origin = process.env.ORIGIN ? new URL(process.env.ORIGIN) : null;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

/**
 * TRUST_PROXY decides whose X-Forwarded-* headers are believed:
 *  - "auto" (default): connections from loopback and private networks (a reverse proxy on the
 *    same host, in Docker or on the LAN),
 *  - "true": every connection (only when the port isn't reachable except through the proxy),
 *  - "false": nobody (the app is exposed directly).
 */
const trustProxy = (process.env.TRUST_PROXY || 'auto').toLowerCase();
const XFF_DEPTH = Math.max(1, Number(process.env.XFF_DEPTH) || 1);

/** Requests to these paths may carry large bodies (photo and hero image uploads). */
const LARGE_BODY_PATHS = [/^\/admin\/api\/albums\/\d+\/upload\/?$/, /^\/admin\/settings\/?$/];
/** Every other request body (forms, JSON) must fit in this many bytes. */
const SMALL_BODY_LIMIT = 1024 * 1024;
/** Small bodies must arrive within this time, so slow-drip requests can't pile up. */
const SMALL_BODY_TIMEOUT = 30_000;

const { handler } = await import('./build/handler.js');

/** Proxies can chain values ("https, http"); only the first hop matters. */
function first(value) {
	if (Array.isArray(value)) value = value[0];
	return typeof value === 'string' ? value.split(',')[0].trim() : undefined;
}

function isPrivateAddress(address) {
	if (!address) return false;
	if (address.startsWith('::ffff:')) address = address.slice(7);
	if (net.isIPv4(address)) {
		const [a, b] = address.split('.').map(Number);
		return (
			a === 10 ||
			a === 127 ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 169 && b === 254)
		);
	}
	const lower = address.toLowerCase();
	return lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
}

function trusted(req) {
	if (trustProxy === 'true') return true;
	if (trustProxy === 'false') return false;
	return isPrivateAddress(req.socket.remoteAddress);
}

/** The address the proxy saw, counting XFF_DEPTH entries from the right of X-Forwarded-For. */
function forwardedFor(req) {
	const raw = req.headers['x-forwarded-for'];
	const list = (Array.isArray(raw) ? raw.join(',') : (raw ?? ''))
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	return list.length >= XFF_DEPTH ? list[list.length - XFF_DEPTH] : undefined;
}

function reject(res, status, message) {
	res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', connection: 'close' });
	res.end(message);
}

/** Caps request bodies outside the upload endpoints. Returns false if the request was rejected. */
function limitBody(req, res) {
	if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return true;
	const pathname = (req.url ?? '/').split('?')[0];
	if (LARGE_BODY_PATHS.some((pattern) => pattern.test(pathname))) return true;

	const length = req.headers['content-length'];
	if (length === undefined) {
		if (req.headers['transfer-encoding']) {
			reject(res, 411, 'Length required');
			return false;
		}
		return true;
	}
	if (Number(length) > SMALL_BODY_LIMIT) {
		reject(res, 413, 'Request body too large');
		return false;
	}
	if (Number(length) > 0) {
		const timer = setTimeout(() => req.destroy(), SMALL_BODY_TIMEOUT);
		const clear = () => clearTimeout(timer);
		req.once('end', clear);
		req.once('close', clear);
		res.once('finish', clear);
	}
	return true;
}

const server = http.createServer((req, res) => {
	const fromProxy = trusted(req);

	// Never let a visitor choose the address SvelteKit sees.
	const address = (fromProxy && forwardedFor(req)) || req.socket.remoteAddress || 'unknown';
	req.headers[CLIENT_IP_HEADER] = address;

	if (origin) {
		req.headers['x-forwarded-proto'] = origin.protocol.replace(':', '');
		req.headers['x-forwarded-host'] = origin.host;
	} else {
		const proto = fromProxy ? first(req.headers['x-forwarded-proto']) : undefined;
		req.headers['x-forwarded-proto'] =
			proto === 'https' || proto === 'http' ? proto : req.socket.encrypted ? 'https' : 'http';
		const forwardedHost = fromProxy ? first(req.headers['x-forwarded-host']) : undefined;
		if (forwardedHost) req.headers['x-forwarded-host'] = forwardedHost;
		else delete req.headers['x-forwarded-host'];
	}

	if (!limitBody(req, res)) return;

	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
});

// Uploads can be slow, so the overall request timeout stays off; small bodies have their own
// deadline above, and headersTimeout stops clients that never finish sending headers.
server.requestTimeout = 0;
server.headersTimeout = 30_000;
server.keepAliveTimeout = 61_000;

server.listen(port, host, () => {
	console.log(`[gallery] Listening on http://${host}:${port}`);
});

let closing = false;
function shutdown(signal) {
	if (closing) return;
	closing = true;
	console.log(`[gallery] ${signal} received, shutting down…`);
	server.close(() => process.exit(0));
	server.closeIdleConnections?.();
	setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
