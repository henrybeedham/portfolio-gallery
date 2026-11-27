import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import exifr from 'exifr';
import { paths } from './config.js';

sharp.cache(false);

const SUPPORTED_TYPES: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

const EXTENSION_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif',
	mp4: 'video/mp4',
	m4v: 'video/mp4',
	mov: 'video/quicktime',
	webm: 'video/webm'
};

/** The type a file's name suggests, for listing importable photos and videos. */
export function typeFromFilename(name: string): string | null {
	const ext = path.extname(name).slice(1).toLowerCase();
	return EXTENSION_TYPES[ext] ?? null;
}

const FORMAT_TYPES: Record<string, string> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif'
};

/** Detects the real image type from the file contents, ignoring the claimed extension. Photos only. */
export async function detectType(file: string): Promise<{ mime: string; ext: string } | null> {
	try {
		const meta = await sharp(file, { failOn: 'none' }).metadata();
		const mime = meta.format ? FORMAT_TYPES[meta.format] : undefined;
		return mime ? { mime, ext: SUPPORTED_TYPES[mime] } : null;
	} catch {
		return null;
	}
}

type Variant = 'thumb' | 'medium';

export function newKey() {
	return crypto.randomBytes(12).toString('base64url');
}

function shard(key: string) {
	return key.slice(0, 2).toLowerCase();
}

export function originalPath(key: string, ext: string) {
	return path.join(paths.originals, shard(key), `${key}.${ext}`);
}

export function variantPath(key: string, variant: Variant) {
	return path.join(variant === 'thumb' ? paths.thumbs : paths.medium, shard(key), `${key}.webp`);
}

/** A video's smaller copy for playing in the browser (video-preview.ts). */
export function previewPath(key: string) {
	return path.join(paths.previews, shard(key), `${key}.mp4`);
}

/** Limits how many images are processed by sharp at the same time. */
class Limiter {
	private active = 0;
	private queue: (() => void)[] = [];
	constructor(private readonly max: number) {}

	async run<T>(task: () => Promise<T>): Promise<T> {
		if (this.active >= this.max) await new Promise<void>((resolve) => this.queue.push(resolve));
		this.active++;
		try {
			return await task();
		} finally {
			this.active--;
			this.queue.shift()?.();
		}
	}
}

export const processing = new Limiter(Math.max(1, Math.min(4, os.availableParallelism() - 1)));

/** Thumbnails keep their short edge around 720px so they stay sharp when cropped square. */
function thumbSize(width: number, height: number) {
	const scale = Math.min(1, 720 / Math.min(width, height), 1600 / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

export async function orientedSize(source: string | Buffer) {
	const meta = await sharp(source, { failOn: 'none' }).metadata();
	const swap = (meta.orientation ?? 1) >= 5;
	const width = (swap ? meta.height : meta.width) ?? 0;
	const height = (swap ? meta.width : meta.height) ?? 0;
	return { width, height };
}

/** Thumbnails from a photo, or from a video's poster frame. */
export async function generateVariants(source: string | Buffer, key: string) {
	return processing.run(async () => {
		const { width, height } = await orientedSize(source);
		if (!width || !height) throw new Error('Could not read image dimensions');

		const thumbFile = variantPath(key, 'thumb');
		const mediumFile = variantPath(key, 'medium');
		await fsp.mkdir(path.dirname(thumbFile), { recursive: true });
		await fsp.mkdir(path.dirname(mediumFile), { recursive: true });

		const base = sharp(source, { failOn: 'none' }).autoOrient();
		const thumb = thumbSize(width, height);
		await Promise.all([
			base
				.clone()
				.resize(thumb.width, thumb.height, { fit: 'fill' })
				.webp({ quality: 80, effort: 4 })
				.toFile(thumbFile),
			base
				.clone()
				.resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
				.webp({ quality: 84, effort: 4 })
				.toFile(mediumFile)
		]);

		return { width, height };
	});
}

interface PhotoMetadata {
	takenAt: string | null;
	/** The caption (Lightroom's “Caption”), used as the photo's alt text. */
	caption: string | null;
	/** Keywords from Lightroom and similar tools, which become album tags. */
	keywords: string[];
}

function exifDate(value: unknown): string | null {
	if (value instanceof Date && !isNaN(value.getTime())) {
		return value.toISOString().slice(0, 19);
	}
	if (typeof value !== 'string') return null;
	const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
	if (!match || match[1] === '0000') return null;
	const [, y, m, d, hh, mm, ss] = match;
	return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

/** The longest tag name, matching what the admin UI allows. */
const MAX_KEYWORD_LENGTH = 60;

function decodeXml(value: string) {
	return value.replace(
		/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos));/gi,
		(entity, dec, hex, name) => {
			if (dec || hex) {
				const code = parseInt(dec ?? hex, dec ? 10 : 16);
				return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
			}
			return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase() as 'amp'];
		}
	);
}

/**
 * The `dc:subject` keywords in an XMP packet. Lightroom writes these according to each keyword's
 * export settings (parent keywords included only when it is set to export them). They're read from
 * the raw XML because exifr turns a lone keyword into a string, numeric ones into numbers and
 * leaves entities like `&amp;` encoded.
 */
function xmpKeywords(xmp: unknown): string[] {
	if (typeof xmp !== 'string') return [];
	const subject = /<dc:subject(?:\s[^>]*)?>([\s\S]*?)<\/dc:subject>/.exec(xmp);
	if (!subject) return [];
	return [...subject[1].matchAll(/<rdf:li(?:\s[^>]*)?>([^<]*)<\/rdf:li>/g)].map((match) =>
		decodeXml(match[1])
	);
}

/** The default-language `dc:description` in an XMP packet, which is where Lightroom puts captions. */
function xmpCaption(xmp: unknown): string | null {
	if (typeof xmp !== 'string') return null;
	const description = /<dc:description(?:\s[^>]*)?>([\s\S]*?)<\/dc:description>/.exec(xmp);
	if (!description) return null;
	const items = [...description[1].matchAll(/<rdf:li(\s[^>]*)?>([^<]*)<\/rdf:li>/g)];
	const item = items.find((match) => /x-default/.test(match[1] ?? '')) ?? items[0];
	return item ? decodeXml(item[2]) : null;
}

/** The longest caption kept. */
const MAX_CAPTION_LENGTH = 500;

/** The first caption that has any text, tidied to one line. */
function cleanCaption(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value !== 'string') continue;
		const text = value.replace(/[\0\s]+/g, ' ').trim();
		if (text) return text.slice(0, MAX_CAPTION_LENGTH);
	}
	return null;
}

/**
 * IPTC keywords, for files whose XMP has none. exifr decodes them as Latin-1, but Lightroom and most
 * current tools write UTF-8, so they're re-read as UTF-8 when the bytes allow it.
 */
function iptcKeywords(value: unknown): string[] {
	const list = Array.isArray(value) ? value : [value];
	return list
		.filter((item) => typeof item === 'string' || typeof item === 'number')
		.map((item) => {
			const latin1 = String(item);
			const utf8 = Buffer.from(latin1, 'latin1').toString('utf8');
			return utf8.includes('\uFFFD') ? latin1 : utf8;
		});
}

/** Trims, drops empty and over-long keywords, and removes case-insensitive duplicates. */
function cleanKeywords(keywords: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const keyword of keywords) {
		const name = keyword.replace(/[\0\s]+/g, ' ').trim();
		const folded = name.toLowerCase();
		if (!name || name.length > MAX_KEYWORD_LENGTH || seen.has(folded)) continue;
		seen.add(folded);
		result.push(name);
	}
	return result;
}

/**
 * Reads the bytes exifr needs. JPEG EXIF lives in the first 64 KB; other formats may store it
 * near the end, so they're read whole. (Passing a path to exifr leaks a file handle, which
 * crashes recent Node versions when it is garbage collected.)
 */
async function metadataBytes(source: string): Promise<Buffer> {
	const handle = await fsp.open(source, 'r');
	try {
		const { size } = await handle.stat();
		const header = Buffer.alloc(Math.min(size, 12));
		await handle.read(header, 0, header.length, 0);
		const isJpeg = header[0] === 0xff && header[1] === 0xd8;
		const length = isJpeg ? Math.min(size, 512 * 1024) : Math.min(size, 64 * 1024 * 1024);
		const buffer = Buffer.alloc(length);
		await handle.read(buffer, 0, length, 0);
		return buffer;
	} finally {
		await handle.close();
	}
}

export async function extractMetadata(source: string): Promise<PhotoMetadata> {
	let exif: Record<string, unknown> | undefined;
	try {
		exif = await exifr.parse(await metadataBytes(source), {
			tiff: true,
			exif: true,
			gps: false,
			iptc: true,
			// The raw packet, parsed by xmpKeywords. Parsed XMP would also be merged over the EXIF values.
			xmp: { parse: false },
			icc: false,
			jfif: false,
			ihdr: false,
			reviveValues: false,
			translateValues: false
		});
	} catch {
		exif = undefined;
	}
	if (!exif) return { takenAt: null, caption: null, keywords: [] };
	const xmp = xmpKeywords(exif.xmp);
	const iptcCaption = iptcKeywords(exif.Caption)[0];

	return {
		takenAt:
			exifDate(exif.DateTimeOriginal) ?? exifDate(exif.CreateDate) ?? exifDate(exif.ModifyDate),
		caption: cleanCaption(xmpCaption(exif.xmp), iptcCaption, exif.ImageDescription),
		keywords: cleanKeywords(xmp.length ? xmp : iptcKeywords(exif.Keywords))
	};
}

export async function removePhotoFiles(key: string, ext: string) {
	await Promise.all(
		[
			originalPath(key, ext),
			variantPath(key, 'thumb'),
			variantPath(key, 'medium'),
			previewPath(key)
		].map((file) => fsp.rm(file, { force: true }))
	);
}

/** Moves a file, falling back to copy + delete across devices. */
export async function moveFile(from: string, to: string) {
	await fsp.mkdir(path.dirname(to), { recursive: true });
	try {
		await fsp.rename(from, to);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
		await fsp.copyFile(from, to);
		await fsp.rm(from, { force: true });
	}
}

export function tempFile(ext = 'upload') {
	fs.mkdirSync(paths.tmp, { recursive: true });
	return path.join(paths.tmp, `${crypto.randomBytes(8).toString('hex')}.${ext}`);
}

/* ---------------------------------------------------------------- hero image */

export function heroPath(size: 'large' | 'small') {
	return path.join(paths.site, `hero-${size}.webp`);
}

export async function saveHeroImage(source: string) {
	await fsp.mkdir(paths.site, { recursive: true });
	const base = sharp(source, { failOn: 'none' }).autoOrient();
	await Promise.all([
		base
			.clone()
			.resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 84 })
			.toFile(heroPath('large')),
		base
			.clone()
			.resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 82 })
			.toFile(heroPath('small'))
	]);
}

export async function removeHeroImage() {
	await Promise.all(
		(['large', 'small'] as const).map((size) => fsp.rm(heroPath(size), { force: true }))
	);
}
