<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import FilePlus from '@lucide/svelte/icons/file-plus';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CircleCheckBig from '@lucide/svelte/icons/circle-check-big';
	import ImageIcon from '@lucide/svelte/icons/image';
	import StageIcon from '#lib/components/admin/StageIcon.svelte';
	import StateBadge from '#lib/components/admin/StateBadge.svelte';
	import type { Stage } from '#lib/job-stage.js';
	import { formatMoney } from '#lib/money.js';
	import {
		addDays,
		formatBytes,
		formatJobDate,
		formatShortDay,
		invoiceLabel,
		mediaUrl,
		plural,
		todayIso
	} from '#lib/utils.js';
	import type { PageProps } from '../../../routes/admin/(app)/$types';

	let { data }: PageProps = $props();

	/** How many of each “needs attention” group to list before linking to the rest. */
	const LIMIT = 5;
	const today = todayIso();
	const monthName = new Date().toLocaleDateString('en-GB', { month: 'long' });
	const todayLabel = new Date().toLocaleDateString('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});

	const attentionCount = $derived(
		data.attention.overdue.length + data.attention.deliver.length + data.attention.invoice.length
	);

	/** “Today”, “Tomorrow”, “In 3 days”. */
	function relativeDay(startsAt: string) {
		const day = startsAt.slice(0, 10);
		if (day === today) return 'Today';
		if (day === addDays(today, 1)) return 'Tomorrow';
		const [y, m, d] = day.split('-').map(Number);
		const [ty, tm, td] = today.split('-').map(Number);
		const days = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
		return `In ${days} days`;
	}

	/** Parts of a date for the little calendar tile in “Coming up”. */
	function tile(startsAt: string) {
		const [y, m, d] = startsAt.slice(0, 10).split('-').map(Number);
		const date = new Date(Date.UTC(y, m - 1, d));
		const part = (options: Intl.DateTimeFormatOptions) =>
			date.toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
		return { weekday: part({ weekday: 'short' }), day: d, month: part({ month: 'short' }) };
	}

	/** “+12%” against last week, or nothing worth saying. */
	function change(now: number, before: number) {
		if (!before) return now ? 'New this week' : '';
		const percent = Math.round(((now - before) / before) * 100);
		if (!percent) return 'Same as last week';
		return `${percent > 0 ? '+' : '−'}${Math.abs(percent)}% on last week`;
	}

	const money = $derived([
		{
			label: 'Outstanding',
			value: formatMoney(data.money.outstanding),
			note: plural(data.money.unpaidCount, 'invoice'),
			href: '/admin/invoices?show=unpaid'
		},
		{
			label: 'Overdue',
			value: formatMoney(data.money.overdue),
			note: plural(data.money.overdueCount, 'invoice'),
			href: '/admin/invoices?show=overdue',
			danger: data.money.overdueCount > 0
		},
		{
			label: `Paid in ${monthName}`,
			value: formatMoney(data.money.paidThisMonth),
			note: plural(data.money.paidThisMonthCount, 'invoice'),
			href: '/admin/invoices?show=paid'
		},
		{
			label: `Paid in ${data.money.taxYear}`,
			value: formatMoney(data.money.paidThisTaxYear),
			note: 'This tax year',
			href: '/admin/invoices/tax-year'
		}
	]);

	const activity = $derived([
		{
			label: 'Views',
			now: data.activity.week.views,
			before: data.activity.previousWeek.views
		},
		{
			label: 'Photo downloads',
			now: data.activity.week.photoDownloads,
			before: data.activity.previousWeek.photoDownloads
		},
		{
			label: 'Album downloads',
			now: data.activity.week.albumDownloads,
			before: data.activity.previousWeek.albumDownloads
		}
	]);
</script>

<svelte:head>
	<title>Dashboard — {data.settings.siteTitle}</title>
</svelte:head>

<header class="ui-head">
	<div>
		<p class="eyebrow">{todayLabel}</p>
		<h1>Dashboard</h1>
	</div>
	<div class="ui-actions">
		<a class="btn btn-quiet" href="/admin/albums/new"><ImagePlus size={15} /> New Album</a>
		<a class="btn btn-quiet" href="/admin/invoices/new"><FilePlus size={15} /> New Invoice</a>
		<a class="btn btn-solid" href="/admin/jobs/new"><Plus size={15} /> New Job</a>
	</div>
</header>

<!-- Money as a ticker of big condensed figures. -->
<section class="ticker" aria-label="Money">
	{#each money as stat (stat.label)}
		<a class="tick" href={stat.href}>
			<span class="tick-label">{stat.label}</span>
			<strong class="figure" class:danger={stat.danger}>{stat.value}</strong>
			<span class="ui-sub">{stat.note}</span>
		</a>
	{/each}
</section>

{#if data.activity.recent.length}
	<section class="reel" aria-labelledby="recent-heading">
		<div class="reel-head">
			<h2 id="recent-heading">Recently added</h2>
			<a class="all" href="/admin/albums">All galleries <ArrowRight size={13} /></a>
		</div>
		<ul class="reel-strip">
			{#each data.activity.recent as album (album.id)}
				<li>
					<a class="reel-tile" href="/admin/albums/{album.id}">
						{#if album.cover}
							<img src={mediaUrl(album.cover, 'medium')} alt="" loading="lazy" />
						{:else}
							<span class="no-cover"><ImageIcon size={22} strokeWidth={1.25} /></span>
						{/if}
						<span class="reel-info">
							<span class="reel-title">{album.title}</span>
							<span class="reel-count">{plural(album.count, 'photo')}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#snippet group(stage: Stage, title: string, count: number, href: string)}
	<div class="group-head stage-{stage}">
		<span class="stage-icon" aria-hidden="true"><StageIcon {stage} /></span>
		<h3>{title}</h3>
		<span class="ui-count">{count}</span>
		<a class="all" {href}>View all <ArrowRight size={13} /></a>
	</div>
{/snippet}

{#snippet more(count: number, href: string)}
	{#if count > LIMIT}
		<li class="more"><a {href}>and {count - LIMIT} more</a></li>
	{/if}
{/snippet}

<div class="board">
	<div class="column">
		<section class="ui-panel">
			<div class="ui-panel-head">
				<h2>Needs attention</h2>
				{#if attentionCount}<span class="pill-count">{plural(attentionCount, 'thing')}</span>{/if}
			</div>
			{#if attentionCount}
				<div class="groups">
					{#if data.attention.overdue.length}
						<div class="group">
							{@render group(
								'overdue',
								'Overdue invoices',
								data.attention.overdue.length,
								'/admin/invoices?show=overdue'
							)}
							<ul class="items stage-overdue">
								{#each data.attention.overdue.slice(0, LIMIT) as invoice (invoice.id)}
									<li>
										<a class="item" href="/admin/invoices/{invoice.id}">
											<span class="item-title"
												>{invoice.billToName || invoice.jobs[0]?.title || 'No client'}</span
											>
											<span class="ui-sub">
												{invoiceLabel(invoice.number)} · due {formatShortDay(invoice.dueDate)}
											</span>
										</a>
										<span class="amount">{formatMoney(invoice.total)}</span>
									</li>
								{/each}
								{@render more(data.attention.overdue.length, '/admin/invoices?show=overdue')}
							</ul>
						</div>
					{/if}

					{#if data.attention.deliver.length}
						<div class="group">
							{@render group(
								'deliver',
								'To deliver',
								data.attention.deliver.length,
								'/admin/jobs?show=deliver'
							)}
							<ul class="items stage-deliver">
								{#each data.attention.deliver.slice(0, LIMIT) as job (job.id)}
									<li>
										<a class="item" href="/admin/jobs/{job.id}">
											<span class="item-title">{job.title}</span>
											<span class="ui-sub">
												{[formatJobDate(job.startsAt).day, job.client].filter(Boolean).join(' · ')}
											</span>
										</a>
										<span class="ui-sub">
											{job.albums.length ? 'Gallery linked' : 'No gallery yet'}
										</span>
									</li>
								{/each}
								{@render more(data.attention.deliver.length, '/admin/jobs?show=deliver')}
							</ul>
						</div>
					{/if}

					{#if data.attention.invoice.length}
						<div class="group">
							{@render group(
								'invoice',
								'To invoice',
								data.attention.invoice.length,
								'/admin/jobs?show=invoice'
							)}
							<ul class="items stage-invoice">
								{#each data.attention.invoice.slice(0, LIMIT) as job (job.id)}
									{@const draft = job.invoices.find((invoice) => invoice.state === 'draft')}
									<li>
										<a class="item" href="/admin/jobs/{job.id}">
											<span class="item-title">{job.title}</span>
											<span class="ui-sub">
												{[formatJobDate(job.startsAt).day, job.client].filter(Boolean).join(' · ')}
											</span>
										</a>
										{#if draft}
											<a class="action" href="/admin/invoices/{draft.id}">
												Send draft {formatMoney(job.total)}
											</a>
										{:else}
											<a class="action" href="/admin/invoices/new?job={job.id}">Create invoice</a>
										{/if}
									</li>
								{/each}
								{@render more(data.attention.invoice.length, '/admin/jobs?show=invoice')}
							</ul>
						</div>
					{/if}
				</div>
			{:else}
				<div class="ui-empty compact">
					<CircleCheckBig size={26} strokeWidth={1} />
					<h3>All caught up</h3>
					<p>Nothing to deliver, invoice or chase.</p>
				</div>
			{/if}
		</section>

		<section class="ui-panel">
			<div class="ui-panel-head">
				<h2>Coming up</h2>
				<span class="ui-sub">Next {data.aheadDays} days</span>
			</div>
			{#if data.comingUp.length}
				<ul class="upcoming">
					{#each data.comingUp as job (job.id)}
						{@const when = tile(job.startsAt!)}
						{@const time = formatJobDate(job.startsAt, job.endsAt).time}
						<li class:tentative={job.status === 'tentative'}>
							<div class="tile" aria-hidden="true">
								<span>{when.weekday}</span>
								<strong>{when.day}</strong>
								<span>{when.month}</span>
							</div>
							<div class="up-body">
								<a class="ui-title" href="/admin/jobs/{job.id}">{job.title}</a>
								<span class="ui-sub">
									{[relativeDay(job.startsAt!), time, job.client, job.location]
										.filter(Boolean)
										.join(' · ')}
								</span>
							</div>
							{#if job.status === 'tentative'}<StateBadge state="tentative" />{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<div class="ui-empty compact">
					<h3>A quiet fortnight</h3>
					{#if data.nextAfter}
						<p>
							Nothing booked in the next {data.aheadDays} days. Next up:
							<a href="/admin/jobs/{data.nextAfter.id}">{data.nextAfter.title}</a>,
							{formatJobDate(data.nextAfter.startsAt).day}.
						</p>
					{:else}
						<p>No upcoming jobs.</p>
					{/if}
				</div>
			{/if}
		</section>
	</div>

	<div class="column">
		<section class="ui-panel">
			<div class="ui-panel-head">
				<h2>Gallery activity</h2>
				<span class="ui-sub">Last 7 days</span>
			</div>
			<div class="week">
				{#each activity as stat (stat.label)}
					<div class="week-stat">
						<span class="tick-label">{stat.label}</span>
						<strong class="figure">{stat.now.toLocaleString('en-GB')}</strong>
						<span class="ui-sub">{change(stat.now, stat.before)}</span>
					</div>
				{/each}
			</div>

			<div class="sub-section">
				<h3>Most visited</h3>
				{#if data.activity.top.length}
					<ol class="top">
						{#each data.activity.top as album (album.id)}
							<li>
								<a href="/admin/albums/{album.id}">{album.title}</a>
								<span class="ui-sub">
									{plural(album.views, 'view')} · {plural(
										album.photoDownloads + album.albumDownloads,
										'download'
									)}
								</span>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="ui-sub">No visits this week.</p>
				{/if}
			</div>

			<p class="totals">
				All time: {plural(data.activity.totals.albums, 'album')} ·
				{plural(data.activity.totals.photos, 'photo')} ({formatBytes(data.activity.totals.bytes)}) ·
				{plural(data.activity.totals.views, 'view')} ·
				{plural(
					data.activity.totals.photoDownloads + data.activity.totals.albumDownloads,
					'download'
				)}.
				<a href="/admin/analytics">Analytics</a>
			</p>
		</section>
	</div>
</div>

<style>
	.danger {
		color: var(--danger);
	}

	/* ---- money ticker */

	.ticker {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin-bottom: clamp(1.75rem, 3vw, 2.5rem);
		border-block: 1px solid var(--border);
	}

	.tick {
		display: grid;
		align-content: start;
		gap: 0.45rem;
		padding: 1.25rem clamp(0.75rem, 2vw, 1.5rem) 1.35rem;
		text-decoration: none;
		transition: background-color 0.3s var(--ease);
	}

	.tick:first-child {
		padding-left: 0;
	}

	.tick + .tick {
		border-left: 1px solid var(--border);
	}

	.tick:hover {
		background: linear-gradient(
			to top,
			color-mix(in srgb, var(--emphasis) 7%, transparent),
			transparent
		);
	}

	.tick-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	.tick strong {
		font-size: clamp(2.2rem, 4.2vw, 3.6rem);
		font-variant-numeric: lining-nums proportional-nums;
	}

	@media (max-width: 900px) {
		.ticker {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.tick:nth-child(3) {
			padding-left: 0;
			border-left: 0;
		}

		.tick:nth-child(n + 3) {
			border-top: 1px solid var(--border);
		}
	}

	/* ---- recently added reel */

	.reel {
		margin-bottom: clamp(1.75rem, 3vw, 2.5rem);
	}

	.reel-head {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		margin-bottom: 0.9rem;
	}

	.reel-head h2 {
		font-size: 1.65rem;
	}

	.reel-strip {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(220px, 1fr);
		gap: var(--tile-gap);
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: thin;
		border-radius: var(--radius);
	}

	.reel-strip li {
		scroll-snap-align: start;
	}

	.reel-tile {
		position: relative;
		display: block;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		background: var(--placeholder);
		text-decoration: none;
		isolation: isolate;
	}

	.reel-tile img {
		position: absolute;
		inset: 0;
		z-index: -2;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 1.6s var(--ease-slow);
	}

	.reel-tile:hover img {
		transform: scale(1.05);
	}

	.reel-tile::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: linear-gradient(to top, var(--scrim-strong) 0%, transparent 60%);
	}

	.no-cover {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--text-subtle);
	}

	.reel-info {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: grid;
		gap: 0.15rem;
		padding: 0.9rem 1rem;
	}

	.reel-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 500;
		line-height: 1.05;
		text-transform: uppercase;
	}

	.reel-count {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text-muted);
	}

	/* ---- board */

	.board {
		display: grid;
		gap: 1.25rem;
		align-items: start;
	}

	@media (min-width: 1100px) {
		.board {
			grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		}
	}

	.column {
		display: grid;
		gap: 1.25rem;
		min-width: 0;
	}

	.column > .ui-panel + .ui-panel {
		margin-top: 0;
	}

	.ui-panel-head {
		align-items: baseline;
	}

	.pill-count {
		padding: 0.1rem 0.6rem;
		border-radius: var(--pill);
		background: var(--danger-soft);
		color: var(--danger);
		font-size: 0.76rem;
		font-weight: 700;
	}

	.compact {
		padding: 2.5rem 1.5rem;
	}

	.compact a {
		color: var(--text);
		text-underline-offset: 3px;
	}

	/* ---- needs attention */

	.group + .group {
		border-top: 1px solid var(--border);
	}

	.group-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 1rem 1.35rem 0.5rem;
	}

	.group-head .stage-icon {
		margin-top: 0;
	}

	h3 {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 500;
		letter-spacing: 0.05em;
		color: var(--text);
	}

	.ui-count {
		min-width: 1.5rem;
		padding: 0 0.4rem;
		border-radius: var(--pill);
		background: color-mix(in srgb, var(--stage) 16%, transparent);
		color: var(--text);
		font-size: 0.74rem;
		font-weight: 700;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.all {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: auto;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		text-decoration: none;
		white-space: nowrap;
	}

	.all:hover {
		color: var(--text);
	}

	.items {
		margin: 0;
		padding: 0 0 0.85rem;
		list-style: none;
	}

	.items li {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 0 1.35rem;
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-sm);
		background: linear-gradient(
			to right,
			color-mix(in srgb, var(--stage) 12%, transparent),
			transparent 70%
		);
		box-shadow: inset 3px 0 0 var(--stage);
	}

	.items li + li {
		margin-top: 0.3rem;
	}

	.item {
		flex: 1;
		min-width: 0;
		text-decoration: none;
	}

	.item-title {
		display: block;
		font-size: 0.96rem;
		font-weight: 650;
		line-height: 1.35;
	}

	.item:hover .item-title {
		color: var(--emphasis);
	}

	.amount {
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-variant-numeric: lining-nums tabular-nums;
		white-space: nowrap;
	}

	.action {
		flex: none;
		padding: 0.3rem 0.75rem;
		border-radius: var(--pill);
		background: color-mix(in srgb, var(--text) 7%, transparent);
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
		white-space: nowrap;
		transition: background-color 0.25s var(--ease);
	}

	.action:hover {
		background: color-mix(in srgb, var(--text) 13%, transparent);
	}

	.items .more {
		background: none;
		box-shadow: none;
	}

	.more a {
		font-size: 0.82rem;
		color: var(--text-muted);
		text-underline-offset: 3px;
	}

	@media (max-width: 520px) {
		.items li {
			flex-wrap: wrap;
			gap: 0.35rem 1rem;
			margin-inline: 1rem;
		}

		.group-head {
			padding-inline: 1rem;
		}
	}

	/* ---- coming up */

	.upcoming {
		margin: 0;
		padding: 0.5rem 0;
		list-style: none;
	}

	.upcoming li {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.6rem 1.35rem;
	}

	.tile {
		display: grid;
		justify-items: center;
		flex: none;
		width: 56px;
		padding: 0.4rem 0 0.35rem;
		border-radius: var(--radius);
		background: var(--surface);
		font-size: 0.66rem;
		font-weight: 700;
		line-height: 1.3;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.tile strong {
		font-family: var(--font-display);
		font-size: 1.6rem;
		font-weight: 500;
		line-height: 1;
		color: var(--text);
		font-variant-numeric: lining-nums;
	}

	.tentative .tile {
		background: none;
		box-shadow: inset 0 0 0 1px var(--border-strong);
	}

	.up-body {
		flex: 1;
		min-width: 0;
	}

	/* ---- gallery activity */

	.week {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		border-bottom: 1px solid var(--border);
	}

	.week-stat {
		display: grid;
		align-content: start;
		gap: 0.4rem;
		padding: 1.1rem 1.35rem;
	}

	.week-stat + .week-stat {
		border-left: 1px solid var(--border);
	}

	.week-stat strong {
		font-size: 2.3rem;
	}

	@media (max-width: 520px) {
		.week {
			grid-template-columns: minmax(0, 1fr);
		}

		.week-stat + .week-stat {
			border-left: 0;
			border-top: 1px solid var(--border);
		}
	}

	.sub-section {
		display: grid;
		gap: 0.75rem;
		padding: 1.25rem 1.35rem;
		border-bottom: 1px solid var(--border);
	}

	.top {
		display: grid;
		gap: 0.65rem;
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: top;
	}

	.top li {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr);
		counter-increment: top;
	}

	.top li::before {
		content: counter(top, decimal-leading-zero);
		grid-row: span 2;
		font-family: var(--font-display);
		font-size: 1.1rem;
		line-height: 1.3;
		color: var(--text-subtle);
	}

	.top a {
		font-weight: 650;
		text-decoration: none;
	}

	.top a:hover {
		color: var(--emphasis);
	}

	.totals {
		margin: 0;
		padding: 1rem 1.35rem;
		font-size: 0.8rem;
		color: var(--text-subtle);
		line-height: 1.6;
	}

	.totals a {
		color: var(--text-muted);
		text-underline-offset: 3px;
	}
</style>
