/** Round tick values from 0 to at least `max`, about `count` steps. */
export function niceTicks(max: number, count = 4): number[] {
	if (!(max > 0)) return [0, 1];
	const raw = max / count;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 2.5, 5, 10].map((n) => n * magnitude).find((n) => n >= raw) ?? 10 * magnitude;
	const ticks: number[] = [];
	for (let v = 0; v < max + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
	if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
	return ticks;
}

/** A column whose top corners are rounded and whose base is square. */
export function roundedTop(x: number, y: number, w: number, h: number, r = 4): string {
	const radius = Math.max(0, Math.min(r, h, w / 2));
	return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`;
}

/** Keeps a tooltip centred on `x` inside a container `width` wide. */
export function clampTip(x: number, width: number, half = 110) {
	return Math.max(half, Math.min(width - half, x));
}
