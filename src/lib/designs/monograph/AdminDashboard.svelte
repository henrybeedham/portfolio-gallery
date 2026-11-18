<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import FilePlus from '@lucide/svelte/icons/file-plus';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { roman } from './format.js';
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
	const longDate = new Date().toLocaleDateString('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
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

<header class="ui-head">
	<div>
		<p class="eyebrow">{longDate}</p>
		<h1>Dashboard</h1>
	</div>
	<div class="ui-actions">
		<a class="btn btn-quiet" href="/admin/albums/new"
			><ImagePlus size={14} strokeWidth={1.5} /> New Album</a
		>
		<a class="btn btn-quiet" href="/admin/invoices/new"
			><FilePlus size={14} strokeWidth={1.5} /> New Invoice</a
		>
		<a class="btn btn-solid" href="/admin/jobs/new"><Plus size={14} strokeWidth={1.5} /> New Job</a>
	</div>
</header>

<section class="ui-stats" aria-label="Money">
	{#each money as stat (stat.label)}
		<a class="ui-stat" href={stat.href}>
			<span class="eyebrow">{stat.label}</span>
			<strong class:danger={stat.danger}>{stat.value}</strong>
			<span class="ui-note">{stat.note}</span>
		</a>
	{/each}
</section>

{#snippet chapter(stage: Stage, n: number, title: string, count: number, href: string)}
	<div class="chapter-head stage-{stage}">
		<span class="chapter-num">{roman(n)}.</span>
		<h3>{title}</h3>
		<span class="stage-icon" aria-hidden="true"><StageIcon {stage} size={14} /></span>
		<span class="chapter-count">{count}</span>
		<a class="link more-link" {href}>View All <ArrowRight size={12} strokeWidth={1.5} /></a>
	</div>
{/snippet}

{#snippet more(count: number, href: string)}
	{#if count > LIMIT}
		<li class="and-more"><a {href}>and {count - LIMIT} more…</a></li>
	{/if}
{/snippet}

<!-- A book spread: what needs doing on the left page, what’s coming on the right. -->
<div class="spread">
	<section class="page verso" aria-labelledby="attention-title">
		<header class="page-head">
			<p class="eyebrow">
				{attentionCount ? plural(attentionCount, 'thing') : 'Nothing'} outstanding
			</p>
			<h2 id="attention-title">Needs Attention</h2>
		</header>

		{#if attentionCount}
			{#if data.attention.overdue.length}
				<div class="chapter">
					{@render chapter(
						'overdue',
						1,
						'Overdue invoices',
						data.attention.overdue.length,
						'/admin/invoices?show=overdue'
					)}
					<ol class="entries stage-overdue">
						{#each data.attention.overdue.slice(0, LIMIT) as invoice (invoice.id)}
							<li>
								<a class="entry" href="/admin/invoices/{invoice.id}">
									<span class="entry-title"
										>{invoice.billToName || invoice.jobs[0]?.title || 'No client'}</span
									>
									<span class="entry-sub">
										{invoiceLabel(invoice.number)} · due {formatShortDay(invoice.dueDate)}
									</span>
								</a>
								<span class="leader" aria-hidden="true"></span>
								<span class="figure">{formatMoney(invoice.total)}</span>
							</li>
						{/each}
						{@render more(data.attention.overdue.length, '/admin/invoices?show=overdue')}
					</ol>
				</div>
			{/if}

			{#if data.attention.deliver.length}
				<div class="chapter">
					{@render chapter(
						'deliver',
						data.attention.overdue.length ? 2 : 1,
						'To deliver',
						data.attention.deliver.length,
						'/admin/jobs?show=deliver'
					)}
					<ol class="entries stage-deliver">
						{#each data.attention.deliver.slice(0, LIMIT) as job (job.id)}
							<li>
								<a class="entry" href="/admin/jobs/{job.id}">
									<span class="entry-title">{job.title}</span>
									<span class="entry-sub">
										{[formatJobDate(job.startsAt).day, job.client].filter(Boolean).join(' · ')}
									</span>
								</a>
								<span class="leader" aria-hidden="true"></span>
								<span class="note">{job.albums.length ? 'Gallery linked' : 'No gallery yet'}</span>
							</li>
						{/each}
						{@render more(data.attention.deliver.length, '/admin/jobs?show=deliver')}
					</ol>
				</div>
			{/if}

			{#if data.attention.invoice.length}
				<div class="chapter">
					{@render chapter(
						'invoice',
						1 + (data.attention.overdue.length ? 1 : 0) + (data.attention.deliver.length ? 1 : 0),
						'To invoice',
						data.attention.invoice.length,
						'/admin/jobs?show=invoice'
					)}
					<ol class="entries stage-invoice">
						{#each data.attention.invoice.slice(0, LIMIT) as job (job.id)}
							{@const draft = job.invoices.find((invoice) => invoice.state === 'draft')}
							<li>
								<a class="entry" href="/admin/jobs/{job.id}">
									<span class="entry-title">{job.title}</span>
									<span class="entry-sub">
										{[formatJobDate(job.startsAt).day, job.client].filter(Boolean).join(' · ')}
									</span>
								</a>
								<span class="leader" aria-hidden="true"></span>
								{#if draft}
									<a class="link" href="/admin/invoices/{draft.id}"
										>Send Draft {formatMoney(job.total)}</a
									>
								{:else}
									<a class="link" href="/admin/invoices/new?job={job.id}">Create Invoice</a>
								{/if}
							</li>
						{/each}
						{@render more(data.attention.invoice.length, '/admin/jobs?show=invoice')}
					</ol>
				</div>
			{/if}
		{:else}
			<p class="quiet">All caught up — nothing to deliver, invoice or chase.</p>
		{/if}
	</section>

	<div class="gutter" aria-hidden="true"></div>

	<section class="page recto" aria-labelledby="coming-title">
		<header class="page-head">
			<p class="eyebrow">The next {data.aheadDays} days</p>
			<h2 id="coming-title">Coming Up</h2>
		</header>

		{#if data.comingUp.length}
			<ol class="almanac">
				{#each data.comingUp as job (job.id)}
					{@const when = tile(job.startsAt!)}
					{@const time = formatJobDate(job.startsAt, job.endsAt).time}
					<li class:tentative={job.status === 'tentative'}>
						<div class="date" aria-hidden="true">
							<strong>{when.day}</strong>
							<span>{when.month} · {when.weekday}</span>
						</div>
						<div class="day-body">
							<a class="entry-title" href="/admin/jobs/{job.id}">{job.title}</a>
							<span class="entry-sub">
								{[relativeDay(job.startsAt!), time, job.client, job.location]
									.filter(Boolean)
									.join(' · ')}
							</span>
							{#if job.status === 'tentative'}<StateBadge state="tentative" />{/if}
						</div>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="quiet">
				{#if data.nextAfter}
					A quiet fortnight. Next up:
					<a href="/admin/jobs/{data.nextAfter.id}">{data.nextAfter.title}</a>,
					{formatJobDate(data.nextAfter.startsAt).day}.
				{:else}
					A quiet fortnight, with nothing booked.
				{/if}
			</p>
		{/if}
	</section>
</div>

<section class="activity" aria-labelledby="activity-title">
	<header class="section-title">
		<p class="eyebrow">The last seven days</p>
		<h2 id="activity-title">Gallery Activity</h2>
		<div class="ornament" aria-hidden="true"></div>
	</header>

	<div class="figures">
		{#each activity as stat (stat.label)}
			<div class="fig">
				<strong>{stat.now.toLocaleString('en-GB')}</strong>
				<span class="sc">{stat.label}</span>
				<em>{change(stat.now, stat.before)}</em>
			</div>
		{/each}
	</div>

	<div class="lists">
		<div class="list">
			<h3 class="eyebrow">Most Visited</h3>
			{#if data.activity.top.length}
				<ol class="toc">
					{#each data.activity.top as album, i (album.id)}
						<li>
							<span class="toc-num">{roman(i + 1)}.</span>
							<a href="/admin/albums/{album.id}">{album.title}</a>
							<span class="leader" aria-hidden="true"></span>
							<span class="toc-count">
								{plural(album.views, 'view')} · {plural(
									album.photoDownloads + album.albumDownloads,
									'download'
								)}
							</span>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="quiet">No visits this week.</p>
			{/if}
		</div>

		{#if data.activity.recent.length}
			<div class="list">
				<h3 class="eyebrow">Recently Added</h3>
				<ul class="recent">
					{#each data.activity.recent as album (album.id)}
						<li>
							<a href="/admin/albums/{album.id}">
								<span class="mini-mat">
									{#if album.cover}
										<img src={mediaUrl(album.cover, 'thumb')} alt="" loading="lazy" />
									{/if}
								</span>
								<span class="recent-title">{album.title}</span>
								<span class="entry-sub">{plural(album.count, 'photo')}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<p class="totals">
		In all: {plural(data.activity.totals.albums, 'album')} ·
		{plural(data.activity.totals.photos, 'photo')} ({formatBytes(data.activity.totals.bytes)}) ·
		{plural(data.activity.totals.views, 'view')} ·
		{plural(data.activity.totals.photoDownloads + data.activity.totals.albumDownloads, 'download')}.
		<a href="/admin/analytics">See the analytics</a>.
	</p>
</section>

<style>
	.danger {
		color: var(--danger);
	}

	/* ---------------------------------------------------------------- spread */

	.spread {
		display: grid;
		gap: 3rem;
		margin-top: clamp(2.5rem, 5vw, 4rem);
	}

	@media (min-width: 1000px) {
		.spread {
			grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
			gap: clamp(2.5rem, 4vw, 4rem);
		}
	}

	.gutter {
		display: none;
	}

	@media (min-width: 1000px) {
		/* The book's gutter: a hairline running between the two pages. */
		.gutter {
			display: block;
			background: linear-gradient(
				to bottom,
				transparent,
				var(--border-strong) 8%,
				var(--border-strong) 92%,
				transparent
			);
		}
	}

	.page {
		min-width: 0;
	}

	.page-head {
		display: grid;
		justify-items: center;
		gap: 0.2rem;
		padding-bottom: 1rem;
		margin-bottom: 1.25rem;
		border-bottom: 3px double var(--border-strong);
		text-align: center;
	}

	.page-head h2 {
		font-size: clamp(1.9rem, 3vw, 2.4rem);
		font-weight: 400;
	}

	.chapter + .chapter {
		margin-top: 1.75rem;
	}

	.chapter-head {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--border);
	}

	.chapter-num {
		font-family: var(--font-display);
		font-weight: 500;
		letter-spacing: 0.05em;
		color: var(--highlight, var(--text-subtle));
		font-variant-numeric: lining-nums;
	}

	.chapter-head h3 {
		font-family: var(--font-serif);
		font-size: 1.2rem;
		font-style: italic;
		font-weight: 400;
	}

	.chapter-head .stage-icon {
		align-self: center;
		margin: 0;
	}

	.chapter-count {
		font-family: var(--font-sc);
		font-weight: 600;
		color: var(--text-subtle);
	}

	.more-link {
		margin-left: auto;
		font-size: 0.95rem;
	}

	.entries {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.entries li {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.6rem 0 0.6rem 0.9rem;
		border-left: 1px solid var(--stage);
		margin-top: 0.5rem;
	}

	.entry {
		min-width: 0;
		text-decoration: none;
	}

	.entry-title {
		display: block;
		font-size: 1.1rem;
		line-height: 1.3;
		text-decoration: none;
	}

	a.entry:hover .entry-title,
	a.entry-title:hover {
		font-style: italic;
	}

	.entry-sub {
		display: block;
		font-size: 0.92rem;
		font-style: italic;
		color: var(--text-subtle);
		line-height: 1.4;
	}

	.leader {
		flex: 1;
		min-width: 1rem;
		height: 3px;
		background-image: radial-gradient(circle, var(--text-subtle) 0.9px, transparent 1.2px);
		background-size: 7px 3px;
		background-repeat: repeat-x;
		opacity: 0.8;
	}

	.figure {
		flex: none;
		font-family: var(--font-display);
		font-size: 1.2rem;
		font-weight: 500;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.note {
		flex: none;
		font-style: italic;
		color: var(--text-muted);
	}

	.entries .link {
		flex: none;
		font-size: 0.95rem;
	}

	.and-more {
		border-left-color: transparent !important;
		font-style: italic;
	}

	.and-more a {
		color: var(--text-muted);
		text-underline-offset: 3px;
	}

	.quiet {
		padding: 2rem 0;
		text-align: center;
		font-style: italic;
		color: var(--text-muted);
	}

	.quiet a {
		color: var(--text);
		text-underline-offset: 3px;
	}

	@media (max-width: 560px) {
		.entries li {
			flex-wrap: wrap;
		}

		.entries .leader {
			display: none;
		}

		.entry {
			flex-basis: 100%;
		}
	}

	/* --------------------------------------------------------------- almanac */

	.almanac {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.almanac li {
		display: grid;
		grid-template-columns: 5.5rem minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
		padding: 0.9rem 0;
		border-bottom: 1px solid var(--border);
	}

	.date {
		display: grid;
		justify-items: center;
		text-align: center;
		line-height: 1;
	}

	.date strong {
		font-family: var(--font-display);
		font-size: 2.6rem;
		font-weight: 400;
		font-variant-numeric: lining-nums;
	}

	.date span {
		margin-top: 0.25rem;
		font-family: var(--font-sc);
		font-weight: 600;
		font-size: 0.92rem;
		letter-spacing: 0.05em;
		color: var(--text-subtle);
	}

	.tentative .date strong {
		font-style: italic;
		color: var(--text-muted);
	}

	.day-body {
		display: grid;
		justify-items: start;
		gap: 0.25rem;
		padding-top: 0.35rem;
	}

	/* -------------------------------------------------------------- activity */

	.activity {
		margin-top: clamp(4rem, 8vw, 6rem);
	}

	.activity .section-title {
		margin-bottom: 2.25rem;
	}

	.figures {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		border-block: 3px double var(--border-strong);
	}

	.fig {
		display: grid;
		justify-items: center;
		gap: 0.15rem;
		padding: 1.5rem 0.75rem;
		text-align: center;
	}

	.fig + .fig {
		border-left: 1px solid var(--border);
	}

	.fig strong {
		font-family: var(--font-display);
		font-size: clamp(2.4rem, 5vw, 3.4rem);
		font-weight: 400;
		line-height: 1;
		font-variant-numeric: lining-nums;
	}

	.fig .sc {
		font-size: 1rem;
		color: var(--text-muted);
	}

	.fig em {
		font-size: 0.92rem;
		color: var(--text-subtle);
	}

	@media (max-width: 560px) {
		.figures {
			grid-template-columns: minmax(0, 1fr);
		}

		.fig + .fig {
			border-left: 0;
			border-top: 1px solid var(--border);
		}
	}

	.lists {
		display: grid;
		gap: 2.5rem;
		margin-top: 2.5rem;
	}

	@media (min-width: 1000px) {
		.lists {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			gap: clamp(2.5rem, 5vw, 5rem);
		}
	}

	.list h3 {
		margin-bottom: 0.75rem;
		text-align: center;
	}

	.toc {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--border);
	}

	.toc li {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.65rem 0;
		border-bottom: 1px solid var(--border);
	}

	.toc-num {
		flex: none;
		min-width: 2.2em;
		font-family: var(--font-display);
		font-weight: 500;
		color: var(--highlight, var(--text-subtle));
		font-variant-numeric: lining-nums;
	}

	.toc a {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 1.08rem;
		text-decoration: none;
	}

	.toc a:hover {
		font-style: italic;
	}

	.toc-count {
		flex: none;
		font-size: 0.92rem;
		font-style: italic;
		color: var(--text-subtle);
	}

	@media (max-width: 560px) {
		.toc li {
			flex-wrap: wrap;
		}

		.toc .leader {
			display: none;
		}

		.toc-count {
			flex-basis: 100%;
			padding-left: 2.8em;
		}
	}

	.recent {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 1.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.recent a {
		display: grid;
		justify-items: center;
		gap: 0.15rem;
		text-align: center;
		text-decoration: none;
	}

	.mini-mat {
		display: block;
		width: 100%;
		padding: 7px;
		margin-bottom: 0.4rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		transition: border-color 0.6s var(--ease);
	}

	.mini-mat img {
		width: 100%;
		aspect-ratio: 4 / 5;
		object-fit: cover;
		background: var(--placeholder);
		box-shadow: var(--bevel);
	}

	.recent a:hover .mini-mat {
		border-color: var(--border-strong);
	}

	.recent-title {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-style: italic;
	}

	.totals {
		margin-top: 3rem;
		text-align: center;
		font-style: italic;
		color: var(--text-subtle);
	}

	.totals a {
		color: var(--text-muted);
		text-underline-offset: 3px;
	}
</style>
