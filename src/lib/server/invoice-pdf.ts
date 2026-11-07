/**
 * Draws invoices as PDFs with PDFKit, in the colours of the invoice's theme (see themes.ts) and the
 * site's typefaces: Playfair Display for headings and Inter for everything else.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import { getTheme } from './themes.js';
import { formatMoney, formatQuantity, itemsTotal, lineAmount } from '#lib/money.js';
import type { InvoiceDocument } from '#lib/types.js';
import { formatShortDay } from '#lib/utils.js';

const require = createRequire(import.meta.url);

// PDFKit can't read WOFF2, so the static WOFF files are used.
const FONT_FILES = {
	serif: '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff',
	sans: '@fontsource/inter/files/inter-latin-400-normal.woff',
	medium: '@fontsource/inter/files/inter-latin-500-normal.woff',
	semibold: '@fontsource/inter/files/inter-latin-600-normal.woff'
} as const;

type FontName = keyof typeof FONT_FILES;

let fonts: Record<FontName, Buffer> | undefined;

function loadFonts() {
	if (!fonts) {
		fonts = Object.fromEntries(
			Object.entries(FONT_FILES).map(([name, file]) => [
				name,
				fs.readFileSync(require.resolve(file))
			])
		) as Record<FontName, Buffer>;
	}
	return fonts;
}

/* ---------------------------------------------------------------- colours */

type Rgb = [number, number, number];

function parseColor(value: string | undefined): { rgb: Rgb; alpha: number } | null {
	if (!value) return null;
	const v = value.trim().toLowerCase();
	let match = /^#([0-9a-f]{3,8})$/.exec(v);
	if (match) {
		let hex = match[1];
		if (hex.length === 3 || hex.length === 4) hex = hex.replace(/./g, '$&$&');
		if (hex.length !== 6 && hex.length !== 8) return null;
		const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
		return { rgb: [n(0), n(2), n(4)], alpha: hex.length === 8 ? n(6) / 255 : 1 };
	}
	match = /^rgba?\(([^)]+)\)$/.exec(v);
	if (match) {
		const parts = match[1].split(/[\s,/]+/).filter(Boolean);
		if (parts.length < 3) return null;
		const channel = (p: string) =>
			p.endsWith('%') ? (parseFloat(p) / 100) * 255 : Math.min(255, parseFloat(p));
		const alpha = parts[3]
			? parts[3].endsWith('%')
				? parseFloat(parts[3]) / 100
				: parseFloat(parts[3])
			: 1;
		const rgb = parts.slice(0, 3).map(channel) as Rgb;
		if (rgb.some((c) => !Number.isFinite(c))) return null;
		return { rgb, alpha: Number.isFinite(alpha) ? alpha : 1 };
	}
	return null;
}

/** Resolves a theme colour to an opaque colour, blending any transparency over the page. */
function solid(value: string | undefined, page: Rgb, fallback: Rgb): Rgb {
	const parsed = parseColor(value);
	if (!parsed) return fallback;
	const { rgb, alpha } = parsed;
	return rgb.map((c, i) => Math.round(c * alpha + page[i] * (1 - alpha))) as Rgb;
}

function mix(a: Rgb, b: Rgb, amount: number): Rgb {
	return a.map((c, i) => Math.round(c * amount + b[i] * (1 - amount))) as Rgb;
}

function palette(styleId: string) {
	const colors = getTheme(styleId).invoice;
	const page = solid(colors.bg, [255, 255, 255], [246, 241, 232]);
	const ink = solid(colors.text, page, [38, 35, 31]);
	const subtle = solid(colors['text-subtle'], page, mix(ink, page, 0.5));
	const accent = solid(colors.highlight ?? colors.text, page, ink);
	return {
		page,
		ink,
		muted: solid(colors['text-muted'], page, mix(ink, page, 0.7)),
		subtle,
		// Like the site's eyebrows: the theme's highlight colour when it has one.
		label: colors.highlight ? accent : subtle,
		rule: solid(colors.border, page, mix(ink, page, 0.15)),
		ruleStrong: solid(colors['border-strong'], page, mix(ink, page, 0.3)),
		panel: solid(colors.surface, page, mix(ink, page, 0.06)),
		accent
	};
}

/* ----------------------------------------------------------------- layout */

const PAGE = { width: 595.28, height: 841.89 };
const M = 56;
const RIGHT = PAGE.width - M;
const CONTENT = RIGHT - M;
const FOOTER_Y = PAGE.height - 40;

function lines(value: string) {
	return value
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);
}

/** Renders an invoice and resolves with the PDF bytes. */
export function renderInvoicePdf(invoice: InvoiceDocument): Promise<Buffer> {
	const font = loadFonts();
	const c = palette(invoice.style);
	const total = itemsTotal(invoice.items);
	const balance = invoice.paidAt ? 0 : total;

	const doc = new PDFDocument({
		size: 'A4',
		margin: 0,
		autoFirstPage: false,
		info: {
			Title: `Invoice ${invoice.number}`,
			Author: invoice.sender.name || undefined,
			Subject: invoice.billToName ? `Invoice for ${invoice.billToName}` : undefined
		}
	});
	for (const [name, data] of Object.entries(font)) doc.registerFont(name, data);

	const chunks: Buffer[] = [];
	doc.on('data', (chunk: Buffer) => chunks.push(chunk));
	const done = new Promise<Buffer>((resolve, reject) => {
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);
	});

	doc.on('pageAdded', () => {
		doc.save().rect(0, 0, PAGE.width, PAGE.height).fill(c.page).restore();
	});

	// ---- helpers -------------------------------------------------------

	const set = (name: FontName, size: number, color: Rgb) =>
		doc.font(name).fontSize(size).fillColor(color);

	/** Small uppercase tracked label (the site's “eyebrow”). */
	function eyebrow(
		label: string,
		x: number,
		y: number,
		width: number,
		align: 'left' | 'right' = 'left'
	) {
		set('medium', 6.8, c.label);
		doc.text(label.toUpperCase(), x, y, { width, align, characterSpacing: 1.3, lineBreak: false });
	}

	function rule(y: number, color: Rgb = c.rule, x1 = M, x2 = RIGHT) {
		doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(0.6).strokeColor(color).stroke().restore();
	}

	/** Writes lines of text and returns the y below them. */
	function block(
		text: string[],
		x: number,
		y: number,
		width: number,
		style: { font: FontName; size: number; color: Rgb; gap?: number; align?: 'left' | 'right' }
	) {
		let cursor = y;
		for (const line of text) {
			set(style.font, style.size, style.color);
			doc.text(line, x, cursor, { width, align: style.align ?? 'left' });
			cursor = doc.y + (style.gap ?? 1.5);
		}
		return cursor;
	}

	function footer() {
		const parts = [invoice.sender.name, invoice.sender.email].filter(Boolean).join('  ·  ');
		set('sans', 7, c.subtle);
		if (parts) doc.text(parts, M, FOOTER_Y, { width: CONTENT / 2, lineBreak: false });
		doc.text(`Invoice ${invoice.number}`, M + CONTENT / 2, FOOTER_Y, {
			width: CONTENT / 2,
			align: 'right',
			lineBreak: false
		});
	}

	// ---- header --------------------------------------------------------

	doc.addPage();

	// Title block, right.
	set('serif', 44, c.accent);
	doc.text('Invoice', M + CONTENT / 2, M - 12, {
		width: CONTENT / 2,
		align: 'right',
		lineBreak: false
	});
	eyebrow(`No. ${invoice.number}`, M + CONTENT / 2, M + 46, CONTENT / 2, 'right');
	let rightY = M + 60;
	if (invoice.paidAt) {
		const label = `PAID  ${formatShortDay(invoice.paidAt).toUpperCase()}`;
		set('semibold', 6.8, c.accent);
		const w = doc.widthOfString(label, { characterSpacing: 1.3 }) + 16;
		const x = RIGHT - w;
		doc
			.save()
			.rect(x, rightY + 4, w, 17)
			.lineWidth(0.8)
			.strokeColor(c.accent)
			.stroke()
			.restore();
		doc.text(label, x + 8, rightY + 9.5, { characterSpacing: 1.3, lineBreak: false });
		rightY += 26;
	}

	// Sender, left.
	let leftY = M;
	if (invoice.sender.name) {
		set('serif', 17, c.ink);
		doc.text(invoice.sender.name, M, leftY, { width: CONTENT / 2 });
		leftY = doc.y + 6;
	}
	leftY = block(
		[...lines(invoice.sender.address), invoice.sender.phone, invoice.sender.email].filter(Boolean),
		M,
		leftY,
		CONTENT / 2,
		{ font: 'sans', size: 8.8, color: c.muted, gap: 1.2 }
	);

	let y = Math.max(leftY, rightY) + 26;
	rule(y);
	y += 26;

	// ---- bill to, dates and balance ------------------------------------

	const metaWidth = 196;
	const metaX = RIGHT - metaWidth;

	eyebrow('Bill to', M, y, 240);
	let billY = y + 16;
	if (invoice.billToName) {
		set('semibold', 10.5, c.ink);
		doc.text(invoice.billToName, M, billY, { width: 250 });
		billY = doc.y + 3;
	}
	billY = block(lines(invoice.billToAddress), M, billY, 250, {
		font: 'sans',
		size: 9.2,
		color: c.muted,
		gap: 1.2
	});

	let metaY = y - 2;
	const meta: [string, string][] = [['Date', formatShortDay(invoice.issueDate)]];
	if (invoice.dueDate) meta.push(['Due date', formatShortDay(invoice.dueDate)]);
	for (const [label, value] of meta) {
		eyebrow(label, metaX, metaY + 2.5, 90);
		set('sans', 9.2, c.ink);
		doc.text(value, metaX + 90, metaY, { width: metaWidth - 90, align: 'right', lineBreak: false });
		metaY += 22;
	}

	// Balance due panel.
	const panelY = metaY + 4;
	const panelH = 58;
	doc.save().rect(metaX, panelY, metaWidth, panelH).fill(c.panel).restore();
	eyebrow('Balance due', metaX + 14, panelY + 13, metaWidth - 28);
	set('serif', 22, c.ink);
	doc.text(formatMoney(balance), metaX + 14, panelY + 24, {
		width: metaWidth - 28,
		align: 'right',
		lineBreak: false,
		features: ['lnum', 'tnum']
	});
	metaY = panelY + panelH;

	y = Math.max(billY, metaY) + 40;

	// ---- items -----------------------------------------------------------

	const col = {
		item: { x: M, w: 250 },
		qty: { x: M + 262, w: 56 },
		rate: { x: M + 318, w: 78 },
		amount: { x: M + 396, w: RIGHT - (M + 396) }
	};

	function tableHead() {
		eyebrow('Item', col.item.x, y, col.item.w);
		eyebrow('Qty', col.qty.x, y, col.qty.w, 'right');
		eyebrow('Rate', col.rate.x, y, col.rate.w, 'right');
		eyebrow('Amount', col.amount.x, y, col.amount.w, 'right');
		y += 14;
		rule(y, c.ink);
		y += 12;
	}

	tableHead();

	for (const item of invoice.items) {
		set('medium', 9.6, c.ink);
		const height = Math.max(doc.heightOfString(item.description || ' ', { width: col.item.w }), 12);
		if (y + height + 20 > FOOTER_Y - 20) {
			footer();
			doc.addPage();
			y = M;
			tableHead();
		}
		set('medium', 9.6, c.ink);
		doc.text(item.description, col.item.x, y, { width: col.item.w });
		doc.font('sans');
		const nums: [string, { x: number; w: number }][] = [
			[formatQuantity(item.quantity), col.qty],
			[formatMoney(item.rate), col.rate],
			[formatMoney(lineAmount(item)), col.amount]
		];
		for (const [value, { x, w }] of nums) {
			doc.text(value, x, y, { width: w, align: 'right', lineBreak: false, features: ['tnum'] });
		}
		y += height + 12;
		rule(y);
		y += 12;
	}

	// ---- totals ------------------------------------------------------------

	const totals: { label: string; value: string; strong?: boolean }[] = [
		{ label: 'Total', value: formatMoney(total) }
	];
	if (invoice.paidAt) {
		totals.push({
			label: `Paid ${formatShortDay(invoice.paidAt)}`,
			value: `−${formatMoney(total)}`
		});
		totals.push({ label: 'Balance due', value: formatMoney(0), strong: true });
	}
	if (y + totals.length * 22 + 10 > FOOTER_Y - 20) {
		footer();
		doc.addPage();
		y = M;
	}
	y += 2;
	for (const row of totals) {
		set('sans', 9, c.muted);
		doc.text(row.label, metaX, y, { width: 100, lineBreak: false });
		set(row.strong ? 'semibold' : 'medium', 10, c.ink);
		doc.text(row.value, metaX + 100, y - 0.5, {
			width: metaWidth - 100,
			align: 'right',
			lineBreak: false,
			features: ['tnum']
		});
		y += 22;
	}

	// ---- notes and payment details ---------------------------------------------

	const notes = invoice.notes.trim();
	const payment = lines(invoice.paymentDetails);
	if (notes || payment.length) {
		const columns: { label: string; text: string[] }[] = [];
		if (notes) columns.push({ label: 'Notes', text: notes.split('\n') });
		if (payment.length) columns.push({ label: 'Payment information', text: payment });

		const width = columns.length === 2 ? (CONTENT - 36) / 2 : CONTENT * 0.6;
		set('sans', 9.2, c.ink);
		const heights = columns.map(
			(column) =>
				16 +
				column.text.reduce((sum, line) => sum + doc.heightOfString(line || ' ', { width }) + 1.5, 0)
		);
		const needed = Math.max(...heights) + 30;
		y += 18;
		if (y + needed > FOOTER_Y - 16) {
			footer();
			doc.addPage();
			y = M;
		}
		rule(y);
		y += 22;
		columns.forEach((column, i) => {
			const x = M + i * (width + 36);
			eyebrow(column.label, x, y, width);
			block(
				column.text.map((line) => line || ' '),
				x,
				y + 16,
				width,
				{ font: 'sans', size: 9.2, color: c.ink, gap: 1.5 }
			);
		});
	}

	footer();
	doc.end();
	return done;
}
