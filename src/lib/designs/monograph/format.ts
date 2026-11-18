/** Formatting helpers used only by the Monograph design. */

/** 4 → “IV”, for plate and section numbers. Falls back to digits past 3999. */
export function roman(value: number): string {
	let n = Math.floor(value);
	if (n <= 0 || n >= 4000) return String(value);
	const numerals: [number, string][] = [
		[1000, 'M'],
		[900, 'CM'],
		[500, 'D'],
		[400, 'CD'],
		[100, 'C'],
		[90, 'XC'],
		[50, 'L'],
		[40, 'XL'],
		[10, 'X'],
		[9, 'IX'],
		[5, 'V'],
		[4, 'IV'],
		[1, 'I']
	];
	let out = '';
	for (const [size, glyph] of numerals) {
		while (n >= size) {
			out += glyph;
			n -= size;
		}
	}
	return out;
}

/** A photo's file name without its extension, for captions: “IMG_0010.jpg” → “IMG_0010”. */
export function photoTitle(name: string): string {
	return name.replace(/\.[a-z0-9]{2,5}$/i, '');
}
