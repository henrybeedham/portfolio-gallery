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
	import { formatStampDate, frameNo } from './helpers.js';
	import type { PageProps } from '../../../routes/admin/(app)/$types';

	let { data }: PageProps = $props();

	/** How many of each “needs attention” group to list before linking to the rest. */
	const LIMIT = 5;
	const today = todayIso();
	const monthName = new Date().toLocaleDateString('en-GB', { month: 'long' });

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

<header class="ui-head dash-head">
	<div class="dash-title">
		<p class="eyebrow">Overview · Lab ledger</p>
		<h1>Dashboard</h1>
	</div>
	<span class="stamp tilt today" aria-label="Today">{formatStampDate(today)}</span>
	<div class="ui-actions">
		<a class="btn btn-quiet" href="/admin/albums/new"><ImagePlus size={14} /> New Album</a>
		<a class="btn btn-quiet" href="/admin/invoices/new"><FilePlus size={14} /> New Invoice</a>
		<a class="btn btn-solid" href="/admin/jobs/new"><Plus size={14} /> New Job</a>
	</div>
</header>

<section class="ui-stats readouts" aria-label="Money">
	{#each money as stat, i (stat.label)}
		<a class="ui-stat" href={stat.href}>
			<span class="eyebrow"
				><span class="ro-no" aria-hidden="true">{frameNo(i + 1)}</span>{stat.label}</span
			>
			<strong class:danger={stat.danger}>{stat.value}</strong>
			<span class="ui-note">{stat.note}</span>
		</a>
	{/each}
</section>

{#snippet group(stage: Stage, title: string, count: number, href: string)}
	<div class="group-head stage-{stage}">
		<span class="stage-icon" aria-hidden="true"><StageIcon {stage} /></span>
		<h3>{title}</h3>
		<span class="stamp count">{frameNo(count)}</span>
		<a class="all" {href}>View all <ArrowRight size={12} /></a>
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
				{#if attentionCount}<span class="ui-sub">{plural(attentionCount, 'entry', 'entries')}</span
					>{/if}
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
								<strong>{String(when.day).padStart(2, '0')}</strong>
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
						<span class="eyebrow">{stat.label}</span>
						<strong>{stat.now.toLocaleString('en-GB')}</strong>
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

			{#if data.activity.recent.length}
				<div class="sub-section">
					<div class="sub-head">
						<h3>Recently added</h3>
						<a class="all" href="/admin/albums">All galleries <ArrowRight size={12} /></a>
					</div>
					<ul class="recent">
						{#each data.activity.recent as album, i (album.id)}
							<li>
								<a href="/admin/albums/{album.id}">
									<span class="sprockets" aria-hidden="true"></span>
									<span class="cover">
										{#if album.cover}
											<img src={mediaUrl(album.cover, 'thumb')} alt="" loading="lazy" />
										{:else}
											<ImageIcon size={18} strokeWidth={1.25} />
										{/if}
									</span>
									<span class="frame-edge edge" aria-hidden="true">{frameNo(i + 1)} ▸</span>
									<span class="recent-title">{album.title}</span>
									<span class="ui-sub">{plural(album.count, 'photo')}</span>
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

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

	.dash-head {
		align-items: center;
	}

	.today {
		margin-right: auto;
		margin-left: 0.5rem;
		font-size: 0.9rem;
		padding: 0.35rem 0.75rem;
		color: var(--highlight, var(--text));
	}

	.ro-no {
		margin-right: 0.6rem;
		color: var(--text-subtle);
	}

	.readouts :global(.ui-stat strong) {
		font-size: clamp(1.6rem, 2.6vw, 2.3rem);
	}

	.board {
		display: grid;
		gap: 1.5rem;
		align-items: start;
	}

	@media (min-width: 1100px) {
		.board {
			grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		}
	}

	.column {
		display: grid;
		gap: 1.5rem;
		min-width: 0;
	}

	.ui-panel-head {
		align-items: baseline;
	}

	.compact {
		padding: 2.25rem 1.25rem;
	}

	.compact a {
		color: var(--text);
		text-underline-offset: 3px;
	}

	h3 {
		font-family: var(--font-mono);
		font-stretch: normal;
		font-size: 0.68rem;
		font-weight: 500;
		line-height: 1.4;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	/* ---- needs attention: ledger groups */

	.group + .group {
		border-top: 1px solid var(--border-strong);
	}

	.group-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.8rem 1.25rem 0.5rem;
	}

	.group-head .stage-icon {
		margin-top: 0;
	}

	.count {
		padding: 0 0.35rem;
		border-width: 1.5px;
		font-size: 0.62rem;
		color: var(--stage);
	}

	.all {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: auto;
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
		text-decoration: none;
	}

	.all:hover {
		color: var(--text);
	}

	.items {
		margin: 0;
		padding: 0 0 0.6rem;
		list-style: none;
	}

	.items li {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.55rem 1.25rem 0.55rem 0.9rem;
		margin-left: 1.25rem;
		border-left: 3px solid var(--stage);
		border-bottom: 1px dashed var(--border);
	}

	.items li:last-child {
		border-bottom: 0;
	}

	.item {
		flex: 1;
		min-width: 0;
		text-decoration: none;
	}

	.item-title {
		display: block;
		font-family: var(--font-sans);
		font-size: 0.95rem;
		font-weight: 500;
		line-height: 1.3;
	}

	.item:hover .item-title {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.amount {
		font-size: 0.86rem;
		white-space: nowrap;
	}

	.action {
		flex: none;
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
		text-decoration: none;
		border-bottom: 1px solid var(--border-strong);
		white-space: nowrap;
	}

	.action:hover {
		color: var(--text);
		border-color: var(--text);
	}

	.items .more {
		border-left-style: dashed;
	}

	.more a {
		font-size: 0.78rem;
		color: var(--text-muted);
		text-underline-offset: 3px;
	}

	@media (max-width: 520px) {
		.items li {
			flex-wrap: wrap;
			gap: 0.35rem 1rem;
			margin-left: 1rem;
			padding-right: 1rem;
		}

		.group-head {
			padding-left: 1rem;
			padding-right: 1rem;
		}
	}

	/* ---- coming up: date stamps down a schedule */

	.upcoming {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.upcoming li {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--border);
	}

	.upcoming li:last-child {
		border-bottom: 0;
	}

	.tile {
		display: grid;
		justify-items: center;
		flex: none;
		width: 54px;
		padding: 0.25rem 0 0.3rem;
		border: 2px solid var(--text);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		line-height: 1.3;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.tile strong {
		font-family: var(--font-display);
		font-stretch: var(--display-stretch);
		font-size: 1.55rem;
		font-weight: 600;
		line-height: 1;
		color: var(--text);
	}

	.tentative .tile {
		border-style: dashed;
		border-color: var(--border-strong);
	}

	.up-body {
		flex: 1;
		min-width: 0;
	}

	/* ---- gallery activity */

	.week {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		background: var(--border-strong);
		border-bottom: 1px solid var(--border-strong);
	}

	.week-stat {
		display: grid;
		align-content: start;
		gap: 0.4rem;
		padding: 0.95rem 1.1rem;
		background: var(--bg-elevated);
	}

	.week-stat strong {
		font-family: var(--font-mono);
		font-size: 1.7rem;
		font-weight: 500;
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums slashed-zero;
	}

	@media (max-width: 520px) {
		.week {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.sub-section {
		display: grid;
		gap: 0.7rem;
		padding: 1.1rem 1.25rem;
		border-bottom: 1px solid var(--border);
	}

	.sub-head {
		display: flex;
		align-items: center;
	}

	.top {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: top;
		border-top: 1px solid var(--border);
	}

	.top li {
		display: grid;
		grid-template-columns: 2.2rem minmax(0, 1fr);
		padding: 0.45rem 0;
		border-bottom: 1px solid var(--border);
		counter-increment: top;
	}

	.top li::before {
		content: counter(top, decimal-leading-zero);
		grid-row: span 2;
		font-size: 0.72rem;
		color: var(--text-subtle);
	}

	.top a {
		font-family: var(--font-sans);
		font-weight: 500;
		text-decoration: none;
	}

	.top a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	/* Recently added: a short strip of film. */
	.recent {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.recent a {
		display: grid;
		gap: 0.2rem;
		padding: 0 4px 0.5rem;
		text-decoration: none;
	}

	.recent .sprockets {
		margin-inline: -4px;
	}

	.cover {
		display: grid;
		place-items: center;
		aspect-ratio: 4 / 3;
		overflow: hidden;
		background: var(--placeholder);
		outline: 4px solid var(--film);
		color: var(--text-subtle);
	}

	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.recent a:hover img {
		filter: brightness(1.08);
	}

	.frame-edge {
		margin-top: 0.4rem;
	}

	.recent-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-sans);
		font-weight: 500;
		font-size: 0.88rem;
	}

	.totals {
		margin: 0;
		padding: 0.9rem 1.25rem;
		font-size: 0.74rem;
		color: var(--text-subtle);
		line-height: 1.6;
	}

	.totals a {
		color: var(--text-muted);
		text-underline-offset: 3px;
	}
</style>
