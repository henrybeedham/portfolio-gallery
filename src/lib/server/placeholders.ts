import sharp from 'sharp';
import { all, get, run } from './db.js';
import { processing, variantPath } from './images.js';

/** The longest side of a placeholder, which the browser stretches into a soft blur. */
const SIZE = 16;

const queue = new Set<number>();
let running = false;

/** A tiny WebP of a photo's thumbnail, as a data URL. */
async function makePlaceholder(key: string): Promise<string> {
	const buffer = await processing.run(() =>
		sharp(variantPath(key, 'thumb'), { failOn: 'none' })
			.resize(SIZE, SIZE, { fit: 'inside' })
			.webp({ quality: 40 })
			.toBuffer()
	);
	return `data:image/webp;base64,${buffer.toString('base64')}`;
}

async function drain() {
	if (running) return;
	running = true;
	try {
		while (queue.size) {
			const id = queue.values().next().value!;
			queue.delete(id);
			const row = get<{ key: string; version: number }>(
				'SELECT key, version FROM photos WHERE id = ? AND placeholder IS NULL',
				id
			);
			if (!row) continue;
			try {
				const placeholder = await makePlaceholder(row.key);
				// Skipped if the thumbnails changed meanwhile; that change queues the photo again.
				run(
					'UPDATE photos SET placeholder = ? WHERE id = ? AND version = ?',
					placeholder,
					id,
					row.version
				);
			} catch (error) {
				// A missing thumbnail is made again when it's next requested, which queues this again.
				console.warn(`[gallery] Couldn't make a placeholder for photo ${id}:`, error);
			}
		}
	} finally {
		running = false;
	}
}

/** Makes a photo's placeholder in the background, once its thumbnail exists. */
export function queuePlaceholder(photoId: number) {
	queue.add(photoId);
	void drain();
}

/** Photos uploaded before placeholders existed, or whose thumbnails have changed since. */
export function queueMissingPlaceholders() {
	for (const { id } of all<{ id: number }>('SELECT id FROM photos WHERE placeholder IS NULL')) {
		queue.add(id);
	}
	void drain();
}
