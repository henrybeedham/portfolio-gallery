/**
 * Previews: a smaller copy of each video for playing in the browser, so the lightbox starts quickly
 * and plays anywhere (phones record HEVC, which some browsers can't play). Downloads still serve the
 * original.
 *
 * A preview is H.264 and AAC in an MP4 with its index at the front, at most 1080p and 60fps. Videos
 * that already play well in browsers at a modest size don't get one. Encoding runs in the
 * background, one video at a time, after an upload; until it's done the lightbox plays the original.
 * `photos.preview` records the outcome: NULL not yet decided, 0 plays the original, 1 has a preview.
 */
import { execFile } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';
import { all, get, run } from './db.js';
import { moveFile, originalPath, previewPath, tempFile } from './images.js';
import { hasTools } from './video.js';

const exec = promisify(execFile);

/** The longest and shortest edges a preview may have (1080p). */
const MAX_LONG_EDGE = 1920;
const MAX_SHORT_EDGE = 1080;
/** Videos at or under this bitrate that browsers can already play are left as they are. */
const PLAYABLE_BITRATE = 8_000_000;

/** Leaves cores free for serving visitors while a preview is encoded. */
const THREADS = Math.max(1, Math.floor(os.availableParallelism() / 2));

interface Row {
	id: number;
	key: string;
	ext: string;
	mime: string;
	kind: string;
	duration: number | null;
	preview: number | null;
}

interface StreamInfo {
	videoCodec: string;
	pixelFormat: string;
	width: number;
	height: number;
	audioCodec: string | null;
	bitrate: number;
}

async function streamInfo(file: string): Promise<StreamInfo | null> {
	try {
		const { stdout } = await exec(
			'ffprobe',
			['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
			{ maxBuffer: 16 * 1024 * 1024, timeout: 60_000 }
		);
		const data = JSON.parse(stdout) as {
			streams?: {
				codec_type?: string;
				codec_name?: string;
				pix_fmt?: string;
				width?: number;
				height?: number;
				disposition?: { attached_pic?: number };
			}[];
			format?: { bit_rate?: string };
		};
		const video = data.streams?.find(
			(s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1
		);
		if (!video?.width || !video.height) return null;
		const audio = data.streams?.find((s) => s.codec_type === 'audio');
		return {
			videoCodec: video.codec_name ?? '',
			pixelFormat: video.pix_fmt ?? '',
			width: video.width,
			height: video.height,
			audioCodec: audio ? (audio.codec_name ?? '') : null,
			bitrate: Number(data.format?.bit_rate) || Infinity
		};
	} catch {
		return null;
	}
}

/** Whether every browser can already play the original without trouble. */
function playsWell(info: StreamInfo, mime: string) {
	const small =
		Math.max(info.width, info.height) <= MAX_LONG_EDGE &&
		Math.min(info.width, info.height) <= MAX_SHORT_EDGE &&
		info.bitrate <= PLAYABLE_BITRATE;
	if (!small) return false;
	if (mime === 'video/mp4') {
		return (
			info.videoCodec === 'h264' &&
			info.pixelFormat === 'yuv420p' &&
			(info.audioCodec === null || ['aac', 'mp3'].includes(info.audioCodec))
		);
	}
	if (mime === 'video/webm') {
		return (
			['vp8', 'vp9', 'av1'].includes(info.videoCodec) &&
			(info.audioCodec === null || ['opus', 'vorbis'].includes(info.audioCodec))
		);
	}
	return false;
}

/** Scales down (never up) to fit 1080p, keeping both sides even as H.264 needs. */
const SCALE =
	`scale='trunc(iw*min(1,min(${MAX_LONG_EDGE}/max(iw,ih),${MAX_SHORT_EDGE}/min(iw,ih)))/2)*2':-2,` +
	'format=yuv420p';

async function encode(source: string, target: string, duration: number | null) {
	// Generous: a long 4K video on a small server can take several times its length.
	const timeout = Math.max(15 * 60, (duration ?? 0) * 15) * 1000;
	await exec(
		'ffmpeg',
		[
			['-v', 'error', '-nostdin', '-y', '-i', source],
			['-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1', '-map_chapters', '-1'],
			['-vf', SCALE, '-fpsmax', '60'],
			['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-profile:v', 'high'],
			['-maxrate', '6M', '-bufsize', '12M'],
			['-c:a', 'aac', '-b:a', '128k', '-ac', '2'],
			['-movflags', '+faststart', '-threads', String(THREADS), '-f', 'mp4', target]
		].flat(),
		{ maxBuffer: 16 * 1024 * 1024, timeout, killSignal: 'SIGKILL' }
	);
}

function current(id: number, key: string) {
	return get<Row>('SELECT * FROM photos WHERE id = ? AND key = ?', id, key);
}

function record(id: number, key: string, preview: 0 | 1) {
	run('UPDATE photos SET preview = ? WHERE id = ? AND key = ?', preview, id, key);
}

async function exists(file: string) {
	return fsp.access(file).then(
		() => true,
		() => false
	);
}

async function makePreview(id: number, force: boolean) {
	const row = get<Row>('SELECT * FROM photos WHERE id = ?', id);
	if (!row || row.kind !== 'video') return;
	const target = previewPath(row.key);
	if (!force && row.preview === 0) return;
	if (!force && row.preview === 1 && (await exists(target))) return;
	// Left undecided, so a later start with ffmpeg installed makes it.
	if (!(await hasTools())) return;

	const source = originalPath(row.key, row.ext);
	const info = await streamInfo(source);
	if (!info || playsWell(info, row.mime)) {
		await fsp.rm(target, { force: true });
		record(row.id, row.key, 0);
		return;
	}

	const tmp = tempFile('mp4');
	try {
		const started = Date.now();
		await encode(source, tmp, row.duration);
		const [original, preview] = await Promise.all([fsp.stat(source), fsp.stat(tmp)]);
		// It was replaced or deleted while encoding.
		if (!current(row.id, row.key)) return;
		if (preview.size >= original.size) {
			await fsp.rm(target, { force: true });
			record(row.id, row.key, 0);
			return;
		}
		await moveFile(tmp, target);
		if (!current(row.id, row.key)) {
			await fsp.rm(target, { force: true });
			return;
		}
		record(row.id, row.key, 1);
		const seconds = Math.round((Date.now() - started) / 1000);
		console.log(`[gallery] Made a preview of video ${row.id} in ${seconds}s.`);
	} catch (error) {
		console.warn(`[gallery] Couldn’t make a preview of video ${row.id}:`, error);
		// It plays the original instead; regenerating thumbnails tries again.
		if (current(row.id, row.key)) record(row.id, row.key, 0);
	} finally {
		await fsp.rm(tmp, { force: true });
	}
}

const queued = new Set<number>();
let queue = Promise.resolve();

/**
 * Makes a video's preview in the background, if it needs one. `force` makes it again whatever was
 * decided before.
 */
export function queuePreview(id: number, options: { force?: boolean } = {}) {
	if (queued.has(id)) return;
	queued.add(id);
	queue = queue
		.then(() => makePreview(id, options.force ?? false))
		.catch((error) => console.warn('[gallery] Video preview failed:', error))
		.finally(() => queued.delete(id));
}

/** Queues the videos whose preview hasn't been decided, such as ones uploaded before previews. */
export function queueMissingPreviews() {
	const rows = all<{ id: number }>(
		"SELECT id FROM photos WHERE kind = 'video' AND preview IS NULL ORDER BY id DESC"
	);
	for (const row of rows) queuePreview(row.id);
}
