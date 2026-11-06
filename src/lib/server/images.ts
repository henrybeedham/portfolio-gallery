import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import exifr from 'exifr';
import { paths } from './config.js';

sharp.cache(false);

export const SUPPORTED_TYPES: Record<string, string> = {
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
	gif: 'image/gif'
};

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

/** Detects the real image type from the file contents, ignoring the claimed extension. */
export async function detectType(file: string): Promise<{ mime: string; ext: string } | null> {
	try {
		const meta = await sharp(file, { failOn: 'none' }).metadata();
		const mime = meta.format ? FORMAT_TYPES[meta.format] : undefined;
		return mime ? { mime, ext: SUPPORTED_TYPES[mime] } : null;
	} catch {
		return null;
	}
}

export type Variant = 'thumb' | 'medium';

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

export async function orientedSize(source: string) {
	const meta = await sharp(source, { failOn: 'none' }).metadata();
	const swap = (meta.orientation ?? 1) >= 5;
	const width = (swap ? meta.height : meta.width) ?? 0;
	const height = (swap ? meta.width : meta.height) ?? 0;
	return { width, height };
}

export async function generateVariants(source: string, key: string) {
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

export interface PhotoMetadata {
	takenAt: string | null;
	camera: string | null;
	lens: string | null;
	focalLength: number | null;
	aperture: number | null;
	exposureTime: number | null;
	iso: number | null;
}

const EMPTY_METADATA: PhotoMetadata = {
	takenAt: null,
	camera: null,
	lens: null,
	focalLength: null,
	aperture: null,
	exposureTime: null,
	iso: null
};

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

function num(value: unknown): number | null {
	if (typeof value === 'number' && isFinite(value) && value > 0) return value;
	if (Array.isArray(value)) return num(value[0]);
	return null;
}

function text(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.replace(/\0/g, '').trim();
	return trimmed || null;
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
			iptc: false,
			xmp: false,
			icc: false,
			jfif: false,
			ihdr: false,
			reviveValues: false,
			translateValues: false
		});
	} catch {
		exif = undefined;
	}
	if (!exif) return { ...EMPTY_METADATA };

	const make = text(exif.Make);
	const model = text(exif.Model);
	let camera = model;
	if (make && model && !model.toLowerCase().startsWith(make.split(' ')[0].toLowerCase())) {
		camera = `${make} ${model}`;
	} else if (!model) {
		camera = make;
	}

	return {
		takenAt:
			exifDate(exif.DateTimeOriginal) ?? exifDate(exif.CreateDate) ?? exifDate(exif.ModifyDate),
		camera,
		lens: text(exif.LensModel) ?? text(exif.Lens),
		focalLength: num(exif.FocalLength),
		aperture: num(exif.FNumber) ?? num(exif.ApertureValue),
		exposureTime: num(exif.ExposureTime),
		iso: num(exif.ISO) ?? num(exif.ISOSpeedRatings) ?? num(exif.PhotographicSensitivity)
	};
}

export async function removePhotoFiles(key: string, ext: string) {
	await Promise.all(
		[originalPath(key, ext), variantPath(key, 'thumb'), variantPath(key, 'medium')].map((file) =>
			fsp.rm(file, { force: true })
		)
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
