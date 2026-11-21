<script lang="ts">
	import { navigating } from '$app/state';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import TrendingDown from '@lucide/svelte/icons/trending-down';
	import ColumnChart, { type Column } from '#lib/components/charts/ColumnChart.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import BarList from '#lib/components/charts/BarList.svelte';
	import { formatMoney } from '#lib/money.js';
	import { formatShortDay, plural } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const info = $derived(data.insights);
	let customOpen = $state(false);
	const stats = $derived(info.stats);

	/** Whole pounds for axes and big figures; pence only matter on invoices. */
	const pounds = (pence: number) =>
		'£' + Math.round(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 });

	const series = [
		{ key: 'paid', label: 'Paid', color: 'var(--viz-1)' },
		{ key: 'invoiced', label: 'Invoiced, awaiting payment', color: 'var(--viz-2)' },
		{ key: 'booked', label: 'Draft invoices, not sent', color: 'var(--viz-3)' },
		{ key: 'tentative', label: 'Tentative', color: 'var(--viz-4)' }
	];

	const columns: Column[] = $derived(
		info.monthly.map((month) => ({
			key: month.key,
			short: month.short,
			long: month.long,
			sub: month.year,
			values: month.values,
			muted: month.future,
			note: month.jobs ? plural(month.jobs, 'job') : undefined
		}))
	);

	const delta = $derived.by(() => {
		if (!info.previous) return null;
		const change = stats.paid - info.previous.paid;
		return { change, label: info.previous.label };
	});

	const weeks = $derived(info.gallery.weeks);
	const views = $derived(
		weeks.map((week) => ({ key: week.key, label: week.label, value: week.views }))
	);
	const downloads = $derived(
		weeks.map((week) => ({
			key: week.key,
			label: week.label,
			value: week.photos,
			note: week.albums ? `${plural(week.albums, 'full album')} downloaded` : undefined
		}))
	);
</script>

<svelte:head>
	<title>Analytics — {data.settings.siteTitle}</title>
</svelte:head>

<header class="ui-head">
	<div>
		<p class="eyebrow">Insights</p>
		<h1>Analytics</h1>
	</div>
</header>

<div class="filters">
	<nav class="ui-chips" aria-label="Period">
		{#each data.presets as preset (preset.id)}
			<a
				class="ui-chip"
				class:active={info.range.period === preset.id}
				href="?period={preset.id}"
				data-sveltekit-noscroll
				data-sveltekit-replacestate
				onclick={() => (customOpen = false)}
			>
				{preset.id.startsWith('academic') ? `Academic year ${preset.label}` : preset.label}
			</a>
		{/each}
		<button
			type="button"
			class="ui-chip"
			class:active={info.range.period === 'custom' || customOpen}
			aria-expanded={customOpen}
			onclick={() => (customOpen = !customOpen)}
		>
			Custom
		</button>
	</nav>

	{#if customOpen}
		<form class="custom" method="GET" data-sveltekit-noscroll data-sveltekit-replacestate>
			<label class="field">
				<span class="label">From</span>
				<input class="input" type="date" name="from" value={info.range.from} required />
			</label>
			<label class="field">
				<span class="label">To</span>
				<input class="input" type="date" name="to" value={info.range.to} required />
			</label>
			<button class="btn btn-sm btn-solid">Show</button>
		</form>
	{:else}
		<span class="range subtle">
			{formatShortDay(info.range.from)} – {formatShortDay(info.range.to)}
		</span>
	{/if}
</div>

<div class="body" class:loading={!!navigating.to}>
	<section class="ui-stats">
		<div class="ui-stat">
			<span class="eyebrow">Earned</span>
			<strong>{pounds(stats.paid)}</strong>
			{#if delta}
				<span class="ui-note delta" class:up={delta.change > 0} class:down={delta.change < 0}>
					{#if delta.change > 0}<TrendingUp size={13} />{:else if delta.change < 0}<TrendingDown
							size={13}
						/>{/if}
					{delta.change === 0
						? 'Same as'
						: `${delta.change > 0 ? '+' : '−'}${pounds(Math.abs(delta.change))} vs`}
					{delta.label}
				</span>
			{/if}
		</div>
		<div class="ui-stat">
			<span class="eyebrow">Awaiting payment</span>
			<strong>{pounds(stats.invoiced)}</strong>
			<span class="ui-note">Invoiced, not yet paid</span>
		</div>
		<div class="ui-stat">
			<span class="eyebrow">Booked</span>
			<strong>{pounds(stats.booked)}</strong>
			<span class="ui-note">
				{[plural(stats.jobs, 'job'), stats.tentative && `${pounds(stats.tentative)} tentative`]
					.filter(Boolean)
					.join(' · ')}
			</span>
		</div>
		<div class="ui-stat">
			<span class="eyebrow">Average job</span>
			<strong>{stats.jobs ? pounds(stats.averageJob) : '—'}</strong>
			<span class="ui-note">Confirmed jobs</span>
		</div>
		<div class="ui-stat">
			<span class="eyebrow">Time to get paid</span>
			<strong>{stats.daysToPayment === null ? '—' : plural(stats.daysToPayment, 'day')}</strong>
			<span class="ui-note">Average, invoice to payment</span>
		</div>
	</section>

	<section class="ui-panel">
		<div class="ui-panel-head">
			<div>
				<h2>Income by month</h2>
				<p class="hint">By shoot date. Invoices without a job count from their invoice date.</p>
			</div>
		</div>
		<div class="ui-panel-body">
			<ColumnChart
				label="Income by month"
				{series}
				{columns}
				format={formatMoney}
				axisFormat={pounds}
				empty="No jobs or invoices in this period yet."
			/>
		</div>
	</section>

	<div class="pair">
		<section class="ui-panel">
			<div class="ui-panel-head">
				<h2>Top clients</h2>
			</div>
			<div class="ui-panel-body">
				<BarList
					label="Income by client"
					items={info.byClient}
					format={pounds}
					empty="No income in this period yet."
				/>
			</div>
		</section>
		<section class="ui-panel">
			<div class="ui-panel-head">
				<h2>Billed to</h2>
			</div>
			<div class="ui-panel-body">
				<BarList
					label="Income by billing address"
					items={info.byBilling}
					format={pounds}
					empty="No income in this period yet."
				/>
			</div>
		</section>
	</div>

	<section class="ui-panel">
		<div class="ui-panel-head">
			<div>
				<h2>Galleries</h2>
				<p class="hint">
					{#if info.gallery.trackingSince}
						Weekly views and photo downloads, recorded since {formatShortDay(
							info.gallery.trackingSince
						)}. All-time totals are on the <a href="/admin">dashboard</a>.
					{:else}
						Views and downloads are recorded from now on. All-time totals are on the
						<a href="/admin">dashboard</a>.
					{/if}
				</p>
			</div>
			<div class="totals">
				<span><strong>{info.gallery.totals.views.toLocaleString('en-GB')}</strong> views</span>
				<span>
					<strong>{info.gallery.totals.photos.toLocaleString('en-GB')}</strong> photos downloaded
				</span>
				<span>
					<strong>{info.gallery.totals.albums.toLocaleString('en-GB')}</strong> full albums
				</span>
			</div>
		</div>
		<div class="ui-panel-body">
			<div class="pair inner">
				<div>
					<h3 class="chart-title">Views</h3>
					<LineChart
						label="Gallery views per week"
						unit="views"
						points={views}
						empty="A chart appears after the first two weeks of visits."
					/>
				</div>
				<div>
					<h3 class="chart-title">Photo downloads</h3>
					<LineChart
						label="Photos downloaded per week"
						unit="photos downloaded"
						points={downloads}
						empty="A chart appears after the first two weeks of downloads."
					/>
				</div>
			</div>
			<div>
				<h3 class="chart-title">Most viewed albums</h3>
				<BarList
					label="Most viewed albums"
					items={info.gallery.top.map((album) => ({
						key: String(album.id),
						label: album.title,
						value: album.views,
						href: `/admin/albums/${album.id}`,
						note: `${plural(album.photos, 'photo')} downloaded${album.albums ? ` · ${plural(album.albums, 'full download')}` : ''}`
					}))}
					format={(n) => plural(n, 'view')}
					empty="No gallery visits in this period yet."
				/>
			</div>
		</div>
	</section>
</div>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
		margin-bottom: 1.75rem;
	}

	.range {
		font-size: 0.8rem;
	}

	.custom {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.75rem;
	}

	.custom .input {
		min-height: 36px;
		padding-block: 0.35rem;
		font-size: 0.88rem;
		width: auto;
	}

	.body {
		display: grid;
		gap: 1.5rem;
		transition: opacity 0.2s var(--ease);
	}

	/* Refetch keeps the frame: the previous numbers stay, dimmed, until the new ones arrive. */
	.body.loading {
		opacity: 0.55;
	}

	.body :global(.ui-stats) {
		margin-bottom: 0;
	}

	.body :global(.ui-panel + .ui-panel) {
		margin-top: 0;
	}

	.hint a {
		color: inherit;
		text-underline-offset: 3px;
	}

	.delta {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.delta.up {
		color: var(--success);
	}

	.delta.down {
		color: var(--danger);
	}

	.pair {
		display: grid;
		gap: 1.5rem;
	}

	@media (min-width: 1000px) {
		.pair {
			grid-template-columns: 1fr 1fr;
		}
	}

	.pair.inner {
		gap: 2rem;
	}

	.chart-title {
		margin-bottom: 0.75rem;
		font-family: var(--font-sans);
		font-size: 0.66rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}

	.totals {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.25rem;
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	.totals strong {
		color: var(--text);
		font-weight: 600;
	}
</style>
