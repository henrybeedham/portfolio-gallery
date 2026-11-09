/**
 * Videos: ffprobe reads their size, length and date, and ffmpeg takes a frame for the poster, which
 * becomes the thumbnails just like a photo's. Both are in the Docker image. Without them (in
 * development, say) videos still upload, play and download, with a plain poster.
 */
import { execFile } from 'node:child_process';
import fsp from 'node:fs/promises';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { generateVariants, processing } from './images.js';

const exec = promisify(execFile);

let tools: Promise<boolean> | undefined;

function hasTools() {
	tools ??= Promise.all([exec('ffprobe', ['-version']), exec('ffmpeg', ['-version'])]).then(
		() => true,
		() => {
			console.warn('[gallery] ffmpeg isn’t installed, so videos get plain posters.');
			return false;
		}
	);
	return tools;
}

/** Audio and still-image formats that share the MP4 container. */
const NOT_VIDEO = /^(M4A |M4B |M4P |heic|heix|heim|heis|mif1|msf1|avif|avis)$/;

/** Recognises MP4, QuickTime and WebM videos by their first bytes, whatever the file is called. */
export async function detectVideo(
	file: string
): Promise<{ mime: string; ext: string; kind: 'video' } | null> {
	const head = Buffer.alloc(64);
	const handle = await fsp.open(file, 'r');
	try {
		await handle.read(head, 0, head.length, 0);
	} finally {
		await handle.close();
	}
	let type: { mime: string; ext: string } | null = null;
	if (head.toString('latin1', 4, 8) === 'ftyp') {
		const brand = head.toString('latin1', 8, 12);
		if (!NOT_VIDEO.test(brand)) {
			type =
				brand === 'qt  '
					? { mime: 'video/quicktime', ext: 'mov' }
					: { mime: 'video/mp4', ext: 'mp4' };
		}
	} else if (head.readUInt32BE(0) === 0x1a45dfa3 && head.includes('webm')) {
		type = { mime: 'video/webm', ext: 'webm' };
	}
	if (!type) return null;
	// With ffprobe to hand, also make sure there's a picture in it.
	if ((await hasTools()) && !(await probeVideo(file))) return null;
	return { ...type, kind: 'video' };
}

export interface VideoInfo {
	width: number;
	height: number;
	duration: number | null;
	takenAt: string | null;
}

/** When it was filmed, as naive local time like a photo's capture date. */
function filmedAt(tags: Record<string, string>): string | null {
	const lower = Object.fromEntries(Object.entries(tags).map(([k, v]) => [k.toLowerCase(), v]));
	// Phones record local time with its offset here; creation_time is UTC.
	const value =
		lower['com.apple.quicktime.creationdate'] ?? lower['creation_time'] ?? lower['date'] ?? '';
	const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(value);
	// Cameras without a clock write 1904 or 1970.
	if (!match || Number(match[1]) < 1990) return null;
	const [, y, m, d, hh, mm, ss] = match;
	return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

interface ProbeStream {
	codec_type?: string;
	width?: number;
	height?: number;
	duration?: string;
	disposition?: { attached_pic?: number };
	side_data_list?: { rotation?: number }[];
	tags?: Record<string, string>;
}

/** A video's display size (after rotation), length and date, or null if it has no picture. */
export async function probeVideo(file: string): Promise<VideoInfo | null> {
	if (!(await hasTools())) return null;
	try {
		const { stdout } = await exec(
			'ffprobe',
			['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
			{ maxBuffer: 16 * 1024 * 1024, timeout: 60_000 }
		);
		const data = JSON.parse(stdout) as {
			streams?: ProbeStream[];
			format?: { duration?: string; tags?: Record<string, string> };
		};
		const stream = data.streams?.find(
			(s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1
		);
		if (!stream?.width || !stream.height) return null;
		const rotation =
			stream.side_data_list?.find((side) => side.rotation !== undefined)?.rotation ??
			Number(stream.tags?.rotate ?? 0);
		const sideways = Math.abs(rotation) % 180 === 90;
		const duration = Number(data.format?.duration ?? stream.duration);
		return {
			width: sideways ? stream.height : stream.width,
			height: sideways ? stream.width : stream.height,
			duration: Number.isFinite(duration) && duration > 0 ? duration : null,
			takenAt: filmedAt({ ...stream.tags, ...data.format?.tags })
		};
	} catch {
		return null;
	}
}

/** A frame a little way in (past any fade from black), or the first frame, as PNG. */
async function posterFrame(file: string, duration: number | null): Promise<Buffer | null> {
	if (!(await hasTools())) return null;
	for (const at of new Set([Math.min(1, (duration ?? 0) / 10), 0])) {
		try {
			const { stdout } = await exec(
				'ffmpeg',
				['-v', 'error', '-ss', at.toFixed(3), '-i', file, '-frames:v', '1'].concat([
					'-f',
					'image2pipe',
					'-c:v',
					'png',
					'-'
				]),
				{ encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: 120_000 }
			);
			if (stdout.length) return stdout;
		} catch {
			// try the next position
		}
	}
	return null;
}

/** A plain dark frame, for videos ffmpeg can't read. */
function plainPoster(width: number, height: number) {
	return sharp({
		create: {
			width: Math.min(width || 1600, 3840),
			height: Math.min(height || 900, 3840),
			channels: 3,
			background: { r: 28, g: 26, b: 23 }
		}
	})
		.png()
		.toBuffer();
}

/** Reads a video's details and makes its poster thumbnails. */
export async function prepareVideo(file: string, key: string): Promise<VideoInfo> {
	const info = await probeVideo(file);
	const poster =
		(await processing.run(() => posterFrame(file, info?.duration ?? null))) ??
		(await plainPoster(info?.width ?? 0, info?.height ?? 0));
	const size = await generateVariants(poster, key);
	return {
		width: info?.width || size.width,
		height: info?.height || size.height,
		duration: info?.duration ?? null,
		takenAt: info?.takenAt ?? null
	};
}
