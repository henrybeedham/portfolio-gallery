<!--
	An approximate preview of one Scriptable widget (scriptable/Gallery.js), drawn from the same data.
	It mirrors the script's layouts; keep the two in step when either changes.
-->
<script lang="ts">
	import type {
		WidgetColor,
		WidgetData,
		WidgetFamily,
		WidgetJob,
		WidgetKind,
		WidgetTask
	} from '#lib/types.js';

	let {
		data,
		kind,
		family,
		theme
	}: { data: WidgetData; kind: WidgetKind; family: WidgetFamily; theme: string } = $props();

	const lock = $derived(family === 'rectangular' || family === 'circular' || family === 'inline');

	const css = ([hex, alpha]: WidgetColor) => {
		const n = parseInt(hex.slice(1), 16);
		return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
	};

	// “auto” previews as the site theme; on the phone it follows light and dark appearance.
	const palette = $derived(
		(data.themes[theme] ?? data.themes[data.theme] ?? Object.values(data.themes)[0]).colors
	);
	const style = $derived(
		Object.entries(palette)
			.map(([key, value]) => `--w-${key}: ${css(value)}`)
			.join('; ')
	);

	const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
	const jobWhen = (job: WidgetJob) => [job.day, job.time].filter(Boolean).join(' · ');
	function change(now: number, before: number) {
		if (!before) return now ? 'New this week' : 'Quiet so far';
		const pct = Math.round(((now - before) / before) * 100);
		if (pct === 0) return 'Same as last week';
		return `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% on last week`;
	}

	const job = $derived(data.jobs[0]);
	const m = $derived(data.money);
	const a = $derived(data.activity);
	const t = $derived(data.todo);
	const overdueTasks = $derived(t.tasks.filter((task) => task.kind === 'overdue'));
	const chartMax = $derived(Math.max(1, ...a.daily.map((d) => d.views + d.downloads)));

	/** The Lock Screen versions, as [big, small] or lines of text. */
	const circular = $derived.by((): [string, string] => {
		if (kind === 'jobs') {
			if (!job) return ['–', 'jobs'];
			return job.daysUntil === 0
				? ['Today', '']
				: [String(job.daysUntil), job.daysUntil === 1 ? 'day' : 'days'];
		}
		if (kind === 'money') return [String(m.unpaidCount), 'unpaid'];
		if (kind === 'activity') return [String(a.views), 'views'];
		return [String(t.count), 'to do'];
	});

	const inline = $derived.by(() => {
		if (kind === 'overview' || kind === 'jobs') {
			if (job) return `${job.when}: ${job.title}`;
			return kind === 'jobs' ? 'Nothing booked' : `${m.outstanding} outstanding`;
		}
		if (kind === 'money') return `${m.outstanding} outstanding`;
		if (kind === 'activity') return `${a.views} views · ${a.downloads} downloads`;
		return t.count ? `${t.count} to do` : 'All caught up';
	});

	const rectangular = $derived.by((): string[] => {
		if (kind === 'overview') {
			return job
				? [`${job.when} · ${job.time || job.day}`, job.title, `${m.outstanding} outstanding`]
				: ['Nothing booked', `${m.outstanding} outstanding`];
		}
		if (kind === 'jobs') {
			return job
				? [
						`${job.when}${job.time ? ` · ${job.time}` : ''}`,
						job.title,
						...(job.location ? [job.location] : [])
					]
				: ['Nothing booked'];
		}
		if (kind === 'money') {
			return [
				'Outstanding',
				m.outstanding,
				m.overdueCount ? `${m.overdue} overdue` : plural(m.unpaidCount, 'unpaid invoice')
			];
		}
		if (kind === 'activity') {
			return ['This week', `${a.views} views`, plural(a.downloads, 'download')];
		}
		return [
			t.count ? `${t.count} to do` : 'All caught up',
			...t.tasks.slice(0, 2).map((task) => `${task.label} — ${task.detail}`)
		];
	});
</script>

{#snippet label(text: string, tone = 'muted')}
	<span class="w-label" style="color: var(--w-{tone})">{text}</span>
{/snippet}

{#snippet stat(name: string, value: string, size = 20, note = '', tone = 'text')}
	<div class="w-stat">
		{@render label(name)}
		<span class="w-serif" style="font-size: calc({size} * var(--u)); color: var(--w-{tone})"
			>{value}</span
		>
		{#if note}<span class="w-note">{note}</span>{/if}
	</div>
{/snippet}

{#snippet jobRow(j: WidgetJob)}
	{@const detail = [j.time || j.when, j.location || j.client].filter(Boolean).join(' · ')}
	<div class="w-job">
		<div class="w-date">
			<span class="w-serif" style:color={j.daysUntil === 0 ? 'var(--w-highlight)' : undefined}
				>{j.date}</span
			>
			<span class="w-weekday">{j.weekday}</span>
		</div>
		<div class="w-job-info">
			<span class="w-strong">{j.title}</span>
			<span class="w-small">{j.tentative ? `Tentative · ${detail}` : detail}</span>
		</div>
	</div>
{/snippet}

{#snippet taskRow(task: WidgetTask)}
	<div class="w-task">
		<span
			class="w-dot"
			style="background: var(--w-{task.kind === 'overdue'
				? 'danger'
				: task.kind === 'deliver'
					? 'warning'
					: 'highlight'})"
		></span>
		<span class="w-strong">{task.label}</span>
		<span class="w-small w-right">{task.detail}</span>
	</div>
{/snippet}

{#snippet hairline()}
	<div class="w-hairline"></div>
{/snippet}

{#snippet chart(height: number)}
	<div class="w-chart" style="height: calc({height} * var(--u))" aria-hidden="true">
		{#each a.daily as d, i (d.day)}
			{@const recent = i >= a.daily.length - 7}
			<div class="w-bar">
				<span
					style="height: {Math.max(1, (d.views / chartMax) * 100)}%; background: var(--w-{recent
						? 'text'
						: 'border'})"
				></span>
				{#if d.downloads}
					<span
						style="height: {(d.downloads / chartMax) * 100}%; background: var(--w-{recent
							? 'highlight'
							: 'subtle'})"
					></span>
				{/if}
			</div>
		{/each}
	</div>
{/snippet}

{#if lock}
	<div class="lock {family}" aria-label="Lock Screen preview">
		{#if family === 'circular'}
			<span class="w-serif" class:long={circular[0].length > 3}>{circular[0]}</span>
			{#if circular[1]}<span class="caption">{circular[1]}</span>{/if}
		{:else if family === 'inline'}
			<span>{inline}</span>
		{:else}
			{#each rectangular as line, i (i)}
				<span class:first={i === 0} class:big={kind === 'money' && i === 1}>{line}</span>
			{/each}
		{/if}
	</div>
{:else}
	<div class="widget {family}" {style} aria-label="Widget preview">
		{#if kind === 'overview'}
			{#if family === 'small'}
				{@render label(job ? job.when : 'Next job', 'highlight')}
				{#if job}
					<span class="w-serif w-title clamp-2">{job.title}</span>
					<span class="w-small">{job.time || job.day}</span>
				{:else}
					<span class="w-serif w-title w-muted">Nothing booked</span>
				{/if}
				<div class="w-fill"></div>
				{@render stat('Outstanding', m.outstanding, 18)}
			{:else if family === 'medium'}
				<div class="w-row">
					<div class="w-col grow">
						{@render label(job ? job.when : 'Next job', 'highlight')}
						{#if job}
							<span class="w-serif w-title clamp-2">{job.title}</span>
							<span class="w-small">{jobWhen(job)}</span>
							{#if job.location}<span class="w-small w-subtle">{job.location}</span>{/if}
						{:else}
							<span class="w-serif w-title w-muted">Nothing booked</span>
						{/if}
					</div>
					<div class="w-col gap">
						{@render stat(
							'Outstanding',
							m.outstanding,
							18,
							m.overdueCount ? `${m.overdue} overdue` : plural(m.unpaidCount, 'unpaid invoice')
						)}
						{@render stat('This week', `${a.views} views`, 14, plural(a.downloads, 'download'))}
					</div>
				</div>
			{:else}
				{@render label(data.site.title)}
				<div class="w-gap"></div>
				{@render label('Coming up', 'highlight')}
				<div class="w-list">
					{#each data.jobs.slice(0, 3) as j (j.url)}{@render jobRow(j)}{:else}
						<span class="w-serif w-title w-muted">Nothing booked</span>
					{/each}
				</div>
				{@render hairline()}
				<div class="w-row spread">
					{@render stat('Outstanding', m.outstanding, 18)}
					{@render stat('Overdue', m.overdue, 18, '', m.overdueCount ? 'danger' : 'text')}
					{@render stat('This month', m.paidThisMonth, 18)}
				</div>
				{@render hairline()}
				<div class="w-row spread">
					{@render stat('Views this week', String(a.views), 18, change(a.views, a.previousViews))}
					{@render stat('Downloads', String(a.downloads), 18)}
					{@render stat('To do', String(t.count), 18, '', t.count ? 'highlight' : 'text')}
				</div>
			{/if}
		{:else if kind === 'jobs'}
			{#if family === 'small'}
				{@render label(job ? job.when : 'Coming up', 'highlight')}
				{#if job}
					<span class="w-serif w-title clamp-3">{job.title}</span>
					<span class="w-small">{jobWhen(job)}</span>
					{#if job.location}<span class="w-small w-subtle">{job.location}</span>{/if}
					<div class="w-fill"></div>
					{#if data.jobs[1]}<span class="w-note">Then {data.jobs[1].day}</span>{/if}
				{:else}
					<span class="w-serif w-title w-muted">Nothing booked</span>
				{/if}
			{:else}
				{@render label('Coming up', 'highlight')}
				<div class="w-list">
					{#each data.jobs.slice(0, family === 'medium' ? 3 : 7) as j (j.url)}{@render jobRow(
							j
						)}{:else}
						<span class="w-serif w-title w-muted">Nothing booked</span>
					{/each}
				</div>
			{/if}
		{:else if kind === 'money'}
			{#if family === 'small'}
				{@render label('Outstanding')}
				<span class="w-serif" style="font-size: calc(26 * var(--u))">{m.outstanding}</span>
				<span class="w-small">{plural(m.unpaidCount, 'unpaid invoice')}</span>
				<div class="w-fill"></div>
				{#if m.overdueCount}
					{@render stat('Overdue', m.overdue, 16, '', 'danger')}
				{:else}
					{@render stat('This month', m.paidThisMonth, 16)}
				{/if}
			{:else}
				<div class="w-row spread">
					{@render stat('Outstanding', m.outstanding, 22, plural(m.unpaidCount, 'invoice'))}
					{@render stat(
						'Overdue',
						m.overdue,
						22,
						plural(m.overdueCount, 'invoice'),
						m.overdueCount ? 'danger' : 'text'
					)}
				</div>
				<div class="w-row spread">
					{@render stat('Paid this month', m.paidThisMonth, 16)}
					{@render stat(`Paid ${m.taxYear}`, m.paidThisTaxYear, 16)}
				</div>
				{#if family === 'large'}
					{@render hairline()}
					{@render label(
						overdueTasks.length ? 'Overdue invoices' : 'Nothing overdue',
						overdueTasks.length ? 'danger' : 'muted'
					)}
					<div class="w-list">
						{#each overdueTasks.slice(0, 6) as task (task.url)}{@render taskRow(task)}{/each}
					</div>
				{/if}
			{/if}
		{:else if kind === 'activity'}
			{#if family === 'small'}
				{@render label('This week')}
				<span class="w-serif" style="font-size: calc(30 * var(--u))">{a.views}</span>
				<span class="w-small">{a.views === 1 ? 'view' : 'views'}</span>
				<div class="w-fill"></div>
				<span class="w-strong">{plural(a.downloads, 'download')}</span>
				<span class="w-note">{change(a.views, a.previousViews)}</span>
			{:else}
				<div class="w-row">
					{@render stat('Views this week', String(a.views), 24, change(a.views, a.previousViews))}
					{@render stat(
						'Downloads',
						String(a.downloads),
						24,
						change(a.downloads, a.previousDownloads)
					)}
				</div>
				{@render chart(family === 'medium' ? 34 : 70)}
				{#if family === 'large'}
					{@render label('Last 14 days · downloads highlighted', 'subtle')}
					{@render hairline()}
					{@render label('Most visited this week')}
					<div class="w-list tight">
						{#each a.top.slice(0, 5) as album (album.title)}
							<div class="w-task">
								<span class="w-strong">{album.title}</span>
								<span class="w-small w-right">{album.views} views · {album.downloads} dl</span>
							</div>
						{:else}
							<span class="w-small">No visits yet</span>
						{/each}
					</div>
				{/if}
			{/if}
		{:else if family === 'small'}
			{@render label('To do', t.count ? 'highlight' : 'muted')}
			<span class="w-serif" style="font-size: calc({t.count ? 30 : 16} * var(--u))"
				>{t.count || 'All caught up'}</span
			>
			<div class="w-fill"></div>
			{#each t.tasks.slice(0, 2) as task (task.url)}
				<span class="w-strong">{task.label}</span>
				<span class="w-note">{task.detail}</span>
			{/each}
		{:else}
			<div class="w-row spread">
				{@render label('To do', t.count ? 'highlight' : 'muted')}
				{#if t.count}{@render label(plural(t.count, 'thing'))}{/if}
			</div>
			{#if !t.count}<span class="w-serif w-title w-muted">All caught up</span>{/if}
			<div class="w-list">
				{#each t.tasks.slice(0, family === 'medium' ? 4 : 10) as task (task.url)}{@render taskRow(
						task
					)}{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Sizes are iPhone points times --u, which shrinks on narrow screens so a large widget fits. */
	.widget,
	.lock {
		--u: 1px;
		flex: none;
		overflow: hidden;
		font-family: -apple-system, system-ui, sans-serif;
	}

	@media (max-width: 420px) {
		.widget,
		.lock {
			--u: 0.84px;
		}
	}

	.widget {
		display: flex;
		flex-direction: column;
		gap: calc(3 * var(--u));
		padding: calc(14 * var(--u)) calc(15 * var(--u)) calc(12 * var(--u));
		background: var(--w-bg);
		color: var(--w-text);
		/* The system rounds widgets; a hairline marks a background that matches the page. */
		border-radius: calc(22 * var(--u));
		box-shadow: inset 0 0 0 1px var(--w-border);
	}

	.small {
		width: calc(158 * var(--u));
		height: calc(158 * var(--u));
	}

	.medium {
		width: calc(338 * var(--u));
		height: calc(158 * var(--u));
	}

	.large {
		width: calc(338 * var(--u));
		height: calc(354 * var(--u));
	}

	.w-label {
		font-size: calc(9 * var(--u));
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.w-serif {
		font-family: Georgia, 'Times New Roman', serif;
		font-weight: 400;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.w-title {
		font-size: calc(16 * var(--u));
		white-space: normal;
	}

	.clamp-2,
	.clamp-3 {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.clamp-3 {
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	.w-small,
	.w-strong,
	.w-note {
		font-size: calc(11 * var(--u));
		color: var(--w-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.3;
	}

	.w-strong {
		font-size: calc(12 * var(--u));
		font-weight: 500;
		color: var(--w-text);
	}

	.w-note {
		font-size: calc(10 * var(--u));
		color: var(--w-subtle);
	}

	.w-subtle,
	.w-muted {
		color: var(--w-subtle);
	}

	.w-muted {
		color: var(--w-muted);
	}

	.w-fill {
		flex: 1;
	}

	.w-gap {
		height: calc(6 * var(--u));
	}

	.w-row {
		display: flex;
		gap: calc(14 * var(--u));
		min-width: 0;
	}

	.w-row.spread {
		justify-content: space-between;
		align-items: flex-start;
		margin-block: calc(4 * var(--u));
	}

	.w-col {
		display: flex;
		flex-direction: column;
		gap: calc(3 * var(--u));
		min-width: 0;
	}

	.w-col.grow {
		flex: 1;
	}

	.w-col.gap {
		gap: calc(8 * var(--u));
		flex: none;
		max-width: 45%;
	}

	.w-stat {
		display: flex;
		flex-direction: column;
		gap: calc(2 * var(--u));
		min-width: 0;
	}

	.w-stat .w-note {
		font-size: calc(10 * var(--u));
	}

	.w-list {
		display: flex;
		flex-direction: column;
		gap: calc(8 * var(--u));
		margin-top: calc(5 * var(--u));
		min-width: 0;
	}

	.w-list.tight {
		gap: calc(6 * var(--u));
	}

	.w-job {
		display: flex;
		align-items: center;
		gap: calc(10 * var(--u));
		min-width: 0;
	}

	.w-date {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: calc(34 * var(--u));
		flex: none;
	}

	.w-date .w-serif {
		font-size: calc(18 * var(--u));
	}

	.w-weekday {
		font-size: calc(8 * var(--u));
		font-weight: 500;
		text-transform: uppercase;
		color: var(--w-muted);
	}

	.w-job-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.w-job-info .w-strong {
		font-size: calc(13 * var(--u));
	}

	.w-task {
		display: flex;
		align-items: center;
		gap: calc(8 * var(--u));
		min-width: 0;
	}

	.w-dot {
		width: calc(6 * var(--u));
		height: calc(6 * var(--u));
		border-radius: 50%;
		flex: none;
	}

	.w-right {
		margin-left: auto;
		flex: none;
	}

	.w-hairline {
		height: 1px;
		background: var(--w-border);
		margin-block: calc(8 * var(--u));
		flex: none;
	}

	.w-chart {
		display: flex;
		align-items: stretch;
		gap: calc(3 * var(--u));
		margin-block: calc(8 * var(--u)) calc(4 * var(--u));
		flex: none;
	}

	.w-bar {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	/* Lock Screen widgets: the system tints them, here white on a photo-dark background. */
	.lock {
		display: flex;
		flex-direction: column;
		justify-content: center;
		color: #fff;
		background: linear-gradient(135deg, #3a4a5c, #1f2a36);
		padding: calc(8 * var(--u)) calc(12 * var(--u));
		border-radius: calc(14 * var(--u));
		font-size: calc(12 * var(--u));
		line-height: 1.25;
	}

	.lock span {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.lock.rectangular {
		width: calc(172 * var(--u));
		height: calc(76 * var(--u));
	}

	.lock .first {
		font-weight: 700;
	}

	.lock .big {
		font-family: Georgia, serif;
		font-size: calc(18 * var(--u));
	}

	.lock.circular {
		width: calc(76 * var(--u));
		height: calc(76 * var(--u));
		align-items: center;
		border-radius: 50%;
		padding: 0;
	}

	.lock.circular .w-serif {
		font-size: calc(20 * var(--u));
	}

	.lock.circular .w-serif.long {
		font-size: calc(13 * var(--u));
	}

	.lock .caption {
		font-size: calc(7 * var(--u));
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.lock.inline {
		width: calc(240 * var(--u));
		height: auto;
		padding: calc(6 * var(--u)) calc(12 * var(--u));
		border-radius: calc(8 * var(--u));
	}
</style>
