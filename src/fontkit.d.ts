// The parts of fontkit (a dependency of PDFKit) that site-icon.ts uses; it ships no types.
declare module 'fontkit' {
	interface Path {
		transform(m0: number, m1: number, m2: number, m3: number, m4: number, m5: number): Path;
		toSVG(): string;
	}
	interface Glyph {
		path: Path;
	}
	interface GlyphRun {
		glyphs: Glyph[];
		positions: { xAdvance: number; xOffset: number; yOffset: number }[];
		bbox: { minX: number; minY: number; maxX: number; maxY: number };
	}
	interface Font {
		capHeight: number;
		layout(text: string): GlyphRun;
	}
	export function create(buffer: Buffer): Font;
}
