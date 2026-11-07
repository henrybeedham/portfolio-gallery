<script lang="ts" module>
	export interface LinePoint {
		key: string;
		label: string;
		value: number;
		note?: string;
	}
</script>

<script lang="ts">
	import { clampTip, niceTicks } from './scale.js';

	interface Props {
		label: string;
		/** What one unit is called in the tooltip, e.g. “views”. */
		unit: string;
		points: LinePoint[];
		format?: (value: number) => string;
		color?: string;
		height?: number;
		empty?: string;
	}

	let {
		label,
		unit,
		points,
		format = (value: number) => value.toLocaleString('en-GB'),
		color = 'var(--viz-1)',
		height = 190,
		empty = 'Not enough data yet.'
	}: Props = $props();

	let width = $state(0);
	let active = $state<number | null>(null);
	let svg = $state<SVGSVGElement>();

	const M = { top: 18, right: 44, bottom: 28, left: 44 };
	const plotW = $derived(Math.max(0, width - M.left - M.right));
	const plotH = $derived(height - M.top - M.bottom);
	const max = $derived(Math.max(0, ...points.map((p) => p.value)));
	const ticks = $derived(niceTicks(max, 3));
	const top = $derived(ticks[ticks.length - 1] || 1);

	const x = (i: number) =>
		M.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
	const y = (value: number) => M.top + plotH - (value / top) * plotH;

	const line = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(''));
	const area = $derived(
		points.length ? `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : ''
	);
	const last = $derived(points.length - 1);

	function onpointermove(event: PointerEvent) {
		if (!svg || points.length < 2) return;
		const box = svg.getBoundingClientRect();
		const px = event.clientX - box.left - M.left;
		active = Math.max(0, Math.min(last, Math.round((px / plotW) * last)));
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			event.preventDefault();
			const step = event.key === 'ArrowRight' ? 1 : -1;
			active = Math.max(0, Math.min(last, (active ?? last) + step));
		} else if (event.key === 'Escape') {
			active = null;
		}
	}
</script>

<figure class="viz chart">
	{#if points.length > 1}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="plot"
			bind:clientWidth={width}
			style:height="{height}px"
			tabindex="0"
			role="group"
			aria-label="{label}. Use the arrow keys to read each week."
			{onkeydown}
			onfocus={() => (active ??= last)}
			onblur={() => (active = null)}
			onpointerleave={() => (active = null)}
		>
			{#if width}
				<svg bind:this={svg} {width} {height} aria-hidden="true" {onpointermove}>
					{#each ticks as tick (tick)}
						<line
							class={tick === 0 ? 'baseline' : 'grid'}
							x1={M.left}
							x2={width - M.right}
							y1={y(tick)}
							y2={y(tick)}
						/>
						<text class="tick" x={M.left - 10} y={y(tick)} dy="0.32em" text-anchor="end"
							>{format(tick)}</text
						>
					{/each}
					<text class="x" x={x(0)} y={height - 8} text-anchor="start"
						>{points[0].label.replace('w/c ', '')}</text
					>
					<text class="x" x={x(last)} y={height - 8} text-anchor="end"
						>{points[last].label.replace('w/c ', '')}</text
					>

					<path class="area" d={area} fill={color} />
					<path class="line" d={line} stroke={color} />

					{#if active !== null}
						<line class="crosshair" x1={x(active)} x2={x(active)} y1={M.top} y2={y(0)} />
						<circle class="dot" cx={x(active)} cy={y(points[active].value)} r="4" fill={color} />
					{:else}
						<circle class="dot" cx={x(last)} cy={y(points[last].value)} r="4" fill={color} />
						<text class="end" x={x(last) + 9} y={y(points[last].value)} dy="0.32em"
							>{format(points[last].value)}</text
						>
					{/if}
				</svg>

				{#if active !== null}
					{@const point = points[active]}
					<div
						class="tip"
						style:left="{clampTip(x(active), width, 90)}px"
						style:top="{Math.max(0, y(point.value) - 14)}px"
						role="status"
					>
						<p class="tip-title">{point.label}</p>
						<p class="tip-row">
							<span class="line-key" style:background={color}></span>
							<strong>{format(point.value)}</strong>
							<span>{unit}</span>
						</p>
						{#if point.note}<p class="tip-total">{point.note}</p>{/if}
					</div>
				{/if}
			{/if}
		</div>
	{:else}
		<p class="empty">{empty}</p>
	{/if}

	{#if points.length}
		<details class="table-view">
			<summary>Show as table</summary>
			<div class="ui-table-wrap">
				<table class="ui-table">
					<caption class="visually-hidden">{label}</caption>
					<thead>
						<tr><th scope="col">Week</th><th scope="col" class="ui-num">{unit}</th></tr>
					</thead>
					<tbody>
						{#each points as point (point.key)}
							<tr>
								<th scope="row"
									>{point.label}{#if point.note}<span class="ui-sub">{point.note}</span>{/if}</th
								>
								<td class="ui-num">{format(point.value)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	{/if}
</figure>
