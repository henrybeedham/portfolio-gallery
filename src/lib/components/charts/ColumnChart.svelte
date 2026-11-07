<script lang="ts" module>
	export interface ColumnSeries {
		key: string;
		label: string;
		/** A CSS colour, e.g. var(--viz-1). */
		color: string;
	}

	export interface Column {
		key: string;
		short: string;
		long: string;
		/** Printed under the month label (e.g. the year under January). */
		sub?: string;
		values: Record<string, number>;
		note?: string;
		/** Drawn as a lighter label, e.g. months still to come. */
		muted?: boolean;
	}
</script>

<script lang="ts">
	import { clampTip, niceTicks, roundedTop } from './scale.js';

	interface Props {
		/** Accessible name, e.g. “Income by month”. */
		label: string;
		series: ColumnSeries[];
		columns: Column[];
		format: (value: number) => string;
		axisFormat?: (value: number) => string;
		height?: number;
		empty?: string;
	}

	let {
		label,
		series,
		columns,
		format,
		axisFormat = format,
		height = 280,
		empty = 'Nothing to show for this period.'
	}: Props = $props();

	let width = $state(0);
	let active = $state<number | null>(null);

	const M = { top: 26, right: 4, bottom: 44, left: 60 };
	const GAP = 2;

	const plotW = $derived(Math.max(0, width - M.left - M.right));
	const plotH = $derived(height - M.top - M.bottom);
	const totals = $derived(
		columns.map((column) => series.reduce((sum, s) => sum + (column.values[s.key] ?? 0), 0))
	);
	const max = $derived(Math.max(0, ...totals));
	const ticks = $derived(niceTicks(max));
	const top = $derived(ticks[ticks.length - 1] || 1);
	const band = $derived(columns.length ? plotW / columns.length : 0);
	const barW = $derived(Math.max(3, Math.min(24, band * 0.6)));
	const labelEvery = $derived(
		Math.max(1, Math.ceil(columns.length / Math.max(1, Math.floor(plotW / 38))))
	);
	const peak = $derived(max > 0 ? totals.indexOf(max) : -1);

	const y = (value: number) => M.top + plotH - (value / top) * plotH;
	const cx = (i: number) => M.left + band * (i + 0.5);

	/** Stacked segments for one column, bottom-up, with a surface gap between them. */
	function segments(column: Column) {
		const parts: { key: string; color: string; d: string }[] = [];
		let base = 0;
		const drawn = series.filter((s) => (column.values[s.key] ?? 0) > 0);
		drawn.forEach((s, index) => {
			const value = column.values[s.key] ?? 0;
			const y0 = y(base);
			const y1 = y(base + value);
			base += value;
			const isTop = index === drawn.length - 1;
			const h = y0 - y1 - (isTop || y0 - y1 <= GAP * 2 ? 0 : GAP);
			const x = cx(columns.indexOf(column)) - barW / 2;
			parts.push({
				key: s.key,
				color: s.color,
				d: isTop ? roundedTop(x, y0 - h, barW, h) : `M${x},${y0}V${y0 - h}H${x + barW}V${y0}Z`
			});
		});
		return parts;
	}

	function onkeydown(event: KeyboardEvent) {
		if (!columns.length) return;
		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			event.preventDefault();
			const step = event.key === 'ArrowRight' ? 1 : -1;
			active = Math.max(
				0,
				Math.min(columns.length - 1, (active ?? (step > 0 ? -1 : columns.length)) + step)
			);
		} else if (event.key === 'Escape') {
			active = null;
		}
	}
</script>

<figure class="viz chart">
	<div class="legend" aria-hidden="true">
		{#each series as s (s.key)}
			<span class="key"><span class="swatch" style:background={s.color}></span>{s.label}</span>
		{/each}
	</div>

	{#if max > 0}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
		<div
			class="plot"
			bind:clientWidth={width}
			style:height="{height}px"
			tabindex="0"
			role="group"
			aria-label="{label}. Use the arrow keys to read each month."
			{onkeydown}
			onfocus={() => (active ??= peak)}
			onblur={() => (active = null)}
			onpointerleave={() => (active = null)}
		>
			{#if width}
				<svg {width} {height} aria-hidden="true">
					{#each ticks as tick (tick)}
						<line
							class={tick === 0 ? 'baseline' : 'grid'}
							x1={M.left}
							x2={width - M.right}
							y1={y(tick)}
							y2={y(tick)}
						/>
						<text class="tick" x={M.left - 10} y={y(tick)} dy="0.32em" text-anchor="end">
							{axisFormat(tick)}
						</text>
					{/each}

					{#each columns as column, i (column.key)}
						<g class="column" class:dim={active !== null && active !== i}>
							{#each segments(column) as part (part.key)}
								<path d={part.d} fill={part.color} />
							{/each}
						</g>
						{#if i % labelEvery === 0 || column.sub}
							<text
								class="x"
								class:muted={column.muted}
								x={cx(i)}
								y={height - M.bottom + 18}
								text-anchor="middle">{column.short}</text
							>
							{#if column.sub}
								<text class="x sub" x={cx(i)} y={height - M.bottom + 34} text-anchor="middle"
									>{column.sub}</text
								>
							{/if}
						{/if}
						<rect
							class="hit"
							x={M.left + band * i}
							y={M.top}
							width={band}
							height={plotH}
							role="presentation"
							onpointerenter={() => (active = i)}
						/>
					{/each}

					{#if peak >= 0 && active === null}
						<text class="peak" x={cx(peak)} y={y(max) - 8} text-anchor="middle">{format(max)}</text>
					{/if}
				</svg>

				{#if active !== null}
					{@const column = columns[active]}
					<div
						class="tip"
						style:left="{clampTip(cx(active), width)}px"
						style:top="{Math.max(0, y(totals[active]) - 12)}px"
						role="status"
					>
						<p class="tip-title">{column.long}</p>
						{#each series as s (s.key)}
							<p class="tip-row" class:zero={!column.values[s.key]}>
								<span class="line-key" style:background={s.color}></span>
								<strong>{format(column.values[s.key] ?? 0)}</strong>
								<span>{s.label}</span>
							</p>
						{/each}
						<p class="tip-total">
							<strong>{format(totals[active])}</strong>
							total{#if column.note}&ensp;·&ensp;{column.note}{/if}
						</p>
					</div>
				{/if}
			{/if}
		</div>
	{:else}
		<p class="empty">{empty}</p>
	{/if}

	<details class="table-view">
		<summary>Show as table</summary>
		<div class="ui-table-wrap">
			<table class="ui-table">
				<caption class="visually-hidden">{label}</caption>
				<thead>
					<tr>
						<th scope="col">Month</th>
						{#each series as s (s.key)}<th scope="col" class="ui-num">{s.label}</th>{/each}
						<th scope="col" class="ui-num">Total</th>
					</tr>
				</thead>
				<tbody>
					{#each columns as column, i (column.key)}
						<tr>
							<th scope="row"
								>{column.long}{#if column.note}<span class="ui-sub">{column.note}</span>{/if}</th
							>
							{#each series as s (s.key)}<td class="ui-num">{format(column.values[s.key] ?? 0)}</td
								>{/each}
							<td class="ui-num">{format(totals[i])}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</figure>
