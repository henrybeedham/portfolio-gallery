// Production entry point. Wraps the SvelteKit adapter-node handler with a few
// self-hosting conveniences:
//
//  - works both directly over http:// and behind a TLS reverse proxy (the request
//    origin is derived from X-Forwarded-Proto / X-Forwarded-Host when present),
//  - ORIGIN pins the public URL if your proxy doesn't send forwarding headers,
//  - large uploads are allowed by default,
//  - graceful shutdown on SIGTERM / SIGINT (docker stop).

import http from 'node:http';
import process from 'node:process';

process.env.PROTOCOL_HEADER ||= 'x-forwarded-proto';
process.env.HOST_HEADER ||= 'x-forwarded-host';
process.env.BODY_SIZE_LIMIT ||= '512M';

const origin = process.env.ORIGIN ? new URL(process.env.ORIGIN) : null;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

const { handler } = await import('./build/handler.js');

/** Proxies can chain values ("https, http"); only the first hop matters. */
function first(value) {
	if (Array.isArray(value)) value = value[0];
	return typeof value === 'string' ? value.split(',')[0].trim() : undefined;
}

const server = http.createServer((req, res) => {
	if (origin) {
		req.headers['x-forwarded-proto'] = origin.protocol.replace(':', '');
		req.headers['x-forwarded-host'] = origin.host;
	} else {
		const proto = first(req.headers['x-forwarded-proto']);
		req.headers['x-forwarded-proto'] = proto || (req.socket.encrypted ? 'https' : 'http');
		const forwardedHost = first(req.headers['x-forwarded-host']);
		if (forwardedHost) req.headers['x-forwarded-host'] = forwardedHost;
		else delete req.headers['x-forwarded-host'];
	}

	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
});

// Allow slow uploads and long ZIP downloads.
server.requestTimeout = 0;
server.headersTimeout = 65_000;
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
