/** Files larger than this are handed to the browser's own download manager instead of buffered. */
export const STREAM_THRESHOLD = 1.5 * 1024 ** 3;

function filenameFrom(header: string | null, fallback: string) {
	if (!header) return fallback;
	const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
	if (star) {
		try {
			return decodeURIComponent(star[1]);
		} catch {
			// fall through
		}
	}
	const plain = /filename="([^"]+)"/i.exec(header);
	return plain?.[1] ?? fallback;
}

function save(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.rel = 'noopener';
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Starts a regular browser download (no progress, but no memory limits either). */
export function nativeDownload(url: string, body?: Record<string, string>) {
	if (!body) {
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.rel = 'noopener';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		return;
	}
	const form = document.createElement('form');
	form.method = 'POST';
	form.action = url;
	form.style.display = 'none';
	for (const [name, value] of Object.entries(body)) {
		const input = document.createElement('input');
		input.type = 'hidden';
		input.name = name;
		input.value = value;
		form.append(input);
	}
	document.body.append(form);
	form.submit();
	form.remove();
}

/**
 * Downloads a file while reporting progress (0–1, or null when the size is unknown),
 * then hands it to the browser to save.
 */
export async function downloadWithProgress(
	url: string,
	options: {
		filename: string;
		init?: RequestInit;
		onprogress?: (progress: number | null) => void;
	}
) {
	const response = await fetch(url, options.init);
	if (!response.ok || !response.body) {
		throw new Error(response.status === 404 ? 'Nothing to download' : 'Download failed');
	}
	const total = Number(response.headers.get('content-length')) || 0;
	const name = filenameFrom(response.headers.get('content-disposition'), options.filename);
	const reader = response.body.getReader();
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let received = 0;
	options.onprogress?.(total ? 0 : null);

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value as Uint8Array<ArrayBuffer>);
		received += value.byteLength;
		options.onprogress?.(total ? Math.min(1, received / total) : null);
	}

	const type = response.headers.get('content-type') ?? 'application/octet-stream';
	save(new Blob(chunks, { type }), name);
}
