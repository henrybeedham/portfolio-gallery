// Home Screen and Lock Screen widgets for __SITE_TITLE__, for the Scriptable app.
// Set up under Admin → Widgets, where this script was copied from.
//
// Widget parameter: what to show, then optionally a theme.
//   overview · jobs · money · activity · todo        e.g. “jobs” or “money dark” or “todo auto”
// A theme is any theme id from the site (light, dark, green…) or “auto”, which follows the phone’s
// light or dark appearance. Without one, the widget uses the site’s theme.

const SITE = '__SITE_URL__';
// Filled in when the script is copied straight after making a token. Otherwise the script asks for
// one the first time it runs in Scriptable, and keeps it in the Keychain.
const TOKEN = '__TOKEN__';

const KINDS = ['overview', 'jobs', 'money', 'activity', 'todo'];
const KEYCHAIN = `gallery-widget-token ${SITE}`;
const CACHE = 'gallery-widget-cache.json';
const SERIF = 'Georgia';

// ------------------------------------------------------------------ data

function storedToken() {
	if (TOKEN.startsWith('gal_')) {
		Keychain.set(KEYCHAIN, TOKEN);
		return TOKEN;
	}
	return Keychain.contains(KEYCHAIN) ? Keychain.get(KEYCHAIN) : null;
}

async function askForToken(message) {
	const alert = new Alert();
	alert.title = 'Widget token';
	alert.message =
		message ?? 'Paste the token from Admin → Widgets. It only lets widgets read a summary.';
	alert.addSecureTextField('gal_…', '');
	alert.addAction('Save');
	alert.addCancelAction('Cancel');
	if ((await alert.presentAlert()) === -1) return null;
	const value = alert.textFieldValue(0).trim();
	if (!value.startsWith('gal_')) return null;
	Keychain.set(KEYCHAIN, value);
	return value;
}

function cachePath() {
	const files = FileManager.local();
	return files.joinPath(files.documentsDirectory(), CACHE);
}

function readCache() {
	const files = FileManager.local();
	const path = cachePath();
	if (!files.fileExists(path)) return null;
	try {
		return JSON.parse(files.readString(path));
	} catch {
		return null;
	}
}

/** The latest summary, or the last one saved if the site can’t be reached. */
async function load(token) {
	const request = new Request(`${SITE}/api/widget`);
	request.headers = { Authorization: `Bearer ${token}` };
	request.timeoutInterval = 20;
	try {
		const body = await request.loadJSON();
		const status = request.response?.statusCode ?? 0;
		if (status === 401)
			return {
				problem: 'The widget token was revoked. Open Scriptable to add a new one.',
				revoked: true
			};
		if (status !== 200) throw new Error(body?.message ?? `The site answered ${status}`);
		FileManager.local().writeString(cachePath(), JSON.stringify(body));
		return { data: body, stale: false };
	} catch {
		const cached = readCache();
		if (cached) return { data: cached, stale: true };
		return { problem: 'Couldn’t reach the site. Check the phone is online, then try again.' };
	}
}

// ---------------------------------------------------------------- colours

function color([hex, alpha]) {
	return new Color(hex, alpha);
}

/** The palette for a theme id, or “auto” for the site’s light and dark themes by appearance. */
function palette(data, choice) {
	const themes = data.themes;
	const build = (theme) =>
		Object.fromEntries(Object.entries(theme.colors).map(([key, value]) => [key, color(value)]));
	if (choice === 'auto') {
		const site = themes[data.theme];
		const light = site?.scheme === 'light' ? site : (themes.light ?? site);
		const dark = site?.scheme === 'dark' ? site : (themes.dark ?? site);
		const l = build(light);
		const d = build(dark);
		const p = Object.fromEntries(Object.keys(l).map((key) => [key, Color.dynamic(l[key], d[key])]));
		// Drawn images can't change with the appearance, so charts pick one now.
		p.chart = Device.isUsingDarkAppearance() ? dark.colors : light.colors;
		return p;
	}
	const theme = themes[choice] ?? themes[data.theme] ?? Object.values(themes)[0];
	return { ...build(theme), chart: theme.colors };
}

// ----------------------------------------------------------------- layout

let C; // the palette in use

function text(
	stack,
	value,
	{ size = 12, font, color = C.text, lines = 1, scale = 0.75, align } = {}
) {
	const t = stack.addText(String(value));
	t.font = font ?? Font.systemFont(size);
	t.textColor = color;
	t.lineLimit = lines;
	t.minimumScaleFactor = scale;
	if (align === 'right') t.rightAlignText();
	if (align === 'center') t.centerAlignText();
	return t;
}

function serif(stack, value, size, options = {}) {
	return text(stack, value, { font: new Font(SERIF, size), ...options });
}

/** A small uppercase label, like the site’s. */
function label(stack, value, color = C.muted) {
	return text(stack, value.toUpperCase(), { font: Font.mediumSystemFont(9), color, scale: 0.8 });
}

function column(parent, spacing = 0) {
	const s = parent.addStack();
	s.layoutVertically();
	s.spacing = spacing;
	return s;
}

function row(parent, spacing = 0) {
	const s = parent.addStack();
	s.layoutHorizontally();
	s.spacing = spacing;
	return s;
}

function hairline(parent) {
	const line = row(parent);
	line.addSpacer();
	line.size = new Size(0, 1);
	line.backgroundColor = C.border;
}

function plural(count, word) {
	return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function jobWhen(job) {
	return [job.day, job.time].filter(Boolean).join(' · ');
}

function change(now, before) {
	if (!before) return now ? 'New this week' : 'Quiet so far';
	const pct = Math.round(((now - before) / before) * 100);
	if (pct === 0) return 'Same as last week';
	return `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)}% on last week`;
}

function stat(parent, name, value, { size = 20, color = C.text, note } = {}) {
	const s = column(parent, 2);
	label(s, name);
	serif(s, value, size, { color });
	if (note) text(s, note, { size: 10, color: C.subtle });
	return s;
}

/** A date block for job lists: the day number large, the weekday small. */
function dateBlock(parent, job, width = 34) {
	const s = column(parent);
	s.size = new Size(width, 0);
	serif(s, job.date, 18, { align: 'center', color: job.daysUntil === 0 ? C.highlight : C.text });
	text(s, job.weekday.toUpperCase(), {
		font: Font.mediumSystemFont(8),
		color: C.muted,
		align: 'center'
	});
}

function jobRow(parent, job) {
	const r = row(parent, 10);
	r.centerAlignContent();
	dateBlock(r, job);
	const info = column(r, 1);
	text(info, job.title, { size: 13, font: Font.mediumSystemFont(13) });
	const detail = [job.time || job.when, job.location || job.client].filter(Boolean).join(' · ');
	text(info, job.tentative ? `Tentative · ${detail}` : detail, { size: 11, color: C.muted });
	r.addSpacer();
	r.url = job.url;
}

function taskRow(parent, task) {
	const r = row(parent, 8);
	r.centerAlignContent();
	const dot = r.addStack();
	dot.size = new Size(6, 6);
	dot.cornerRadius = 3;
	dot.backgroundColor =
		task.kind === 'overdue' ? C.danger : task.kind === 'deliver' ? C.warning : C.highlight;
	text(r, task.label, { size: 12, font: Font.mediumSystemFont(12) });
	r.addSpacer();
	text(r, task.detail, { size: 11, color: C.muted });
	r.url = task.url;
}

function chart(data, width, height) {
	const daily = data.activity.daily;
	const ctx = new DrawContext();
	ctx.size = new Size(width, height);
	ctx.opaque = false;
	ctx.respectScreenScale = true;
	const max = Math.max(1, ...daily.map((d) => d.views + d.downloads));
	const gap = 3;
	const bar = (width - gap * (daily.length - 1)) / daily.length;
	daily.forEach((d, i) => {
		const x = i * (bar + gap);
		const viewsH = Math.max(1, (d.views / max) * height);
		const downloadsH = (d.downloads / max) * height;
		// The last seven days in the highlight colour, the week before muted.
		const recent = i >= daily.length - 7;
		ctx.setFillColor(color(recent ? C.chart.text : C.chart.border));
		ctx.fillRect(new Rect(x, height - viewsH - downloadsH, bar, viewsH));
		if (downloadsH > 0) {
			ctx.setFillColor(color(recent ? C.chart.highlight : C.chart.subtle));
			ctx.fillRect(new Rect(x, height - downloadsH, bar, downloadsH));
		}
	});
	return ctx.getImage();
}

// ---------------------------------------------------------------- widgets

const isLock = (family) => family.startsWith('accessory');

function nothingBooked(parent) {
	serif(parent, 'Nothing booked', 16, { color: C.muted, lines: 2 });
}

const widgets = {
	overview(w, data, family) {
		const job = data.jobs[0];
		const m = data.money;
		if (family === 'accessoryInline') {
			text(w, job ? `${job.when}: ${job.title}` : `${m.outstanding} outstanding`);
			return;
		}
		if (family === 'accessoryCircular') return circular(w, data.todo.count, 'to do');
		if (family === 'accessoryRectangular') {
			text(w, job ? `${job.when} · ${job.time || job.day}` : 'Nothing booked', {
				font: Font.boldSystemFont(12)
			});
			if (job) text(w, job.title, { size: 12 });
			text(w, `${m.outstanding} outstanding`, { size: 12 });
			return;
		}
		w.url = data.site.url;
		if (family === 'small') {
			label(w, job ? job.when : 'Next job', C.highlight);
			w.addSpacer(4);
			if (job) {
				serif(w, job.title, 16, { lines: 2 });
				text(w, job.time || job.day, { size: 11, color: C.muted });
			} else nothingBooked(w);
			w.addSpacer();
			stat(w, 'Outstanding', m.outstanding, { size: 18 });
			return;
		}
		if (family === 'medium') {
			const r = row(w, 14);
			const left = column(r, 3);
			label(left, job ? job.when : 'Next job', C.highlight);
			if (job) {
				serif(left, job.title, 17, { lines: 2 });
				text(left, jobWhen(job), { size: 11, color: C.muted });
				if (job.location) text(left, job.location, { size: 11, color: C.subtle });
			} else nothingBooked(left);
			left.addSpacer();
			r.addSpacer();
			const right = column(r, 8);
			stat(right, 'Outstanding', m.outstanding, {
				size: 18,
				note: m.overdueCount ? `${m.overdue} overdue` : plural(m.unpaidCount, 'unpaid invoice')
			});
			stat(right, 'This week', `${data.activity.views} views`, {
				size: 14,
				note: plural(data.activity.downloads, 'download')
			});
			return;
		}
		// large and extra large
		label(w, data.site.title);
		w.addSpacer(8);
		label(w, 'Coming up', C.highlight);
		w.addSpacer(6);
		const jobs = column(w, 8);
		if (!data.jobs.length) nothingBooked(jobs);
		data.jobs.slice(0, 3).forEach((j) => jobRow(jobs, j));
		w.addSpacer(12);
		hairline(w);
		w.addSpacer(10);
		const money = row(w);
		stat(money, 'Outstanding', m.outstanding, { size: 18 });
		money.addSpacer();
		stat(money, 'Overdue', m.overdue, { size: 18, color: m.overdueCount ? C.danger : C.text });
		money.addSpacer();
		stat(money, 'This month', m.paidThisMonth, { size: 18 });
		w.addSpacer(10);
		hairline(w);
		w.addSpacer(10);
		const activity = row(w);
		stat(activity, 'Views this week', String(data.activity.views), {
			size: 18,
			note: change(data.activity.views, data.activity.previousViews)
		});
		activity.addSpacer();
		stat(activity, 'Downloads', String(data.activity.downloads), { size: 18 });
		activity.addSpacer();
		stat(activity, 'To do', String(data.todo.count), {
			size: 18,
			color: data.todo.count ? C.highlight : C.text
		});
		w.addSpacer();
	},

	jobs(w, data, family) {
		const job = data.jobs[0];
		if (family === 'accessoryInline') {
			text(w, job ? `${job.when}: ${job.title}` : 'Nothing booked');
			return;
		}
		if (family === 'accessoryCircular') {
			if (!job) return circular(w, '–', 'jobs');
			return job.daysUntil === 0
				? circular(w, 'Today', '')
				: circular(w, job.daysUntil, job.daysUntil === 1 ? 'day' : 'days');
		}
		if (family === 'accessoryRectangular') {
			if (!job) return void text(w, 'Nothing booked', { font: Font.boldSystemFont(13) });
			text(w, `${job.when}${job.time ? ` · ${job.time}` : ''}`, { font: Font.boldSystemFont(12) });
			text(w, job.title, { size: 12, lines: 2 });
			if (job.location) text(w, job.location, { size: 11 });
			return;
		}
		w.url = `${SITE}/admin/jobs`;
		if (family === 'small') {
			label(w, job ? job.when : 'Coming up', C.highlight);
			w.addSpacer(4);
			if (!job) return void nothingBooked(w);
			w.url = job.url;
			serif(w, job.title, 17, { lines: 3 });
			w.addSpacer(3);
			text(w, jobWhen(job), { size: 11, color: C.muted });
			if (job.location) text(w, job.location, { size: 11, color: C.subtle });
			w.addSpacer();
			if (data.jobs.length > 1) text(w, `Then ${data.jobs[1].day}`, { size: 10, color: C.subtle });
			return;
		}
		label(w, 'Coming up', C.highlight);
		w.addSpacer(8);
		const list = column(w, family === 'medium' ? 7 : 10);
		if (!data.jobs.length) nothingBooked(list);
		data.jobs.slice(0, family === 'medium' ? 3 : 7).forEach((j) => jobRow(list, j));
		w.addSpacer();
	},

	money(w, data, family) {
		const m = data.money;
		if (family === 'accessoryInline') return void text(w, `${m.outstanding} outstanding`);
		if (family === 'accessoryCircular') return circular(w, m.unpaidCount, 'unpaid');
		if (family === 'accessoryRectangular') {
			text(w, 'Outstanding', { font: Font.boldSystemFont(12) });
			text(w, m.outstanding, { font: new Font(SERIF, 18) });
			text(w, m.overdueCount ? `${m.overdue} overdue` : plural(m.unpaidCount, 'unpaid invoice'), {
				size: 11
			});
			return;
		}
		w.url = m.url;
		if (family === 'small') {
			label(w, 'Outstanding');
			w.addSpacer(4);
			serif(w, m.outstanding, 26, { scale: 0.5 });
			text(w, plural(m.unpaidCount, 'unpaid invoice'), { size: 11, color: C.muted });
			w.addSpacer();
			if (m.overdueCount) {
				label(w, 'Overdue', C.danger);
				serif(w, m.overdue, 16, { color: C.danger });
			} else {
				label(w, 'This month');
				serif(w, m.paidThisMonth, 16);
			}
			return;
		}
		const grid = column(w, 12);
		const top = row(grid);
		stat(top, 'Outstanding', m.outstanding, { size: 22, note: plural(m.unpaidCount, 'invoice') });
		top.addSpacer();
		stat(top, 'Overdue', m.overdue, {
			size: 22,
			color: m.overdueCount ? C.danger : C.text,
			note: plural(m.overdueCount, 'invoice')
		});
		const bottom = row(grid);
		stat(bottom, 'Paid this month', m.paidThisMonth, { size: 16 });
		bottom.addSpacer();
		stat(bottom, `Paid ${m.taxYear}`, m.paidThisTaxYear, { size: 16 });
		if (family !== 'medium') {
			w.addSpacer(14);
			hairline(w);
			w.addSpacer(10);
			const overdue = data.todo.tasks.filter((t) => t.kind === 'overdue');
			label(
				w,
				overdue.length ? 'Overdue invoices' : 'Nothing overdue',
				overdue.length ? C.danger : C.muted
			);
			w.addSpacer(6);
			const list = column(w, 7);
			overdue.slice(0, 6).forEach((t) => taskRow(list, t));
		}
		w.addSpacer();
	},

	activity(w, data, family) {
		const a = data.activity;
		if (family === 'accessoryInline')
			return void text(w, `${a.views} views · ${a.downloads} downloads`);
		if (family === 'accessoryCircular') return circular(w, a.views, 'views');
		if (family === 'accessoryRectangular') {
			text(w, 'This week', { font: Font.boldSystemFont(12) });
			text(w, `${a.views} views`, { size: 12 });
			text(w, plural(a.downloads, 'download'), { size: 12 });
			return;
		}
		w.url = a.url;
		if (family === 'small') {
			label(w, 'This week');
			w.addSpacer(4);
			serif(w, String(a.views), 30);
			text(w, a.views === 1 ? 'view' : 'views', { size: 11, color: C.muted });
			w.addSpacer();
			text(w, plural(a.downloads, 'download'), { size: 12, font: Font.mediumSystemFont(12) });
			text(w, change(a.views, a.previousViews), { size: 10, color: C.subtle });
			return;
		}
		const top = row(w, 16);
		stat(top, 'Views this week', String(a.views), {
			size: 24,
			note: change(a.views, a.previousViews)
		});
		stat(top, 'Downloads', String(a.downloads), {
			size: 24,
			note: change(a.downloads, a.previousDownloads)
		});
		top.addSpacer();
		w.addSpacer(10);
		const image = w.addImage(
			chart(data, family === 'medium' ? 300 : 300, family === 'medium' ? 34 : 70)
		);
		image.imageSize = new Size(family === 'medium' ? 306 : 306, family === 'medium' ? 34 : 70);
		image.resizable = true;
		if (family !== 'medium') {
			w.addSpacer(6);
			label(w, 'Last 14 days · downloads highlighted', C.subtle);
			w.addSpacer(12);
			hairline(w);
			w.addSpacer(10);
			label(w, 'Most visited this week');
			w.addSpacer(6);
			const list = column(w, 6);
			if (!a.top.length) text(list, 'No visits yet', { size: 12, color: C.muted });
			a.top.slice(0, 5).forEach((album) => {
				const r = row(list);
				text(r, album.title, { size: 12, font: Font.mediumSystemFont(12) });
				r.addSpacer();
				text(r, `${album.views} views · ${album.downloads} dl`, { size: 11, color: C.muted });
			});
		}
		w.addSpacer();
	},

	todo(w, data, family) {
		const t = data.todo;
		if (family === 'accessoryInline')
			return void text(w, t.count ? `${t.count} to do` : 'All caught up');
		if (family === 'accessoryCircular') return circular(w, t.count, 'to do');
		if (family === 'accessoryRectangular') {
			text(w, t.count ? `${t.count} to do` : 'All caught up', { font: Font.boldSystemFont(12) });
			t.tasks
				.slice(0, 2)
				.forEach((task) => text(w, `${task.label} — ${task.detail}`, { size: 11 }));
			return;
		}
		w.url = t.url;
		if (family === 'small') {
			label(w, 'To do', t.count ? C.highlight : C.muted);
			w.addSpacer(2);
			serif(w, t.count ? String(t.count) : 'All caught up', t.count ? 30 : 16, { lines: 2 });
			w.addSpacer();
			const list = column(w, 3);
			t.tasks.slice(0, 2).forEach((task) => {
				text(list, task.label, { size: 11, font: Font.mediumSystemFont(11) });
				text(list, task.detail, { size: 10, color: C.muted });
			});
			return;
		}
		const head = row(w);
		label(head, 'To do', t.count ? C.highlight : C.muted);
		head.addSpacer();
		if (t.count) label(head, plural(t.count, 'thing'));
		w.addSpacer(8);
		if (!t.count) serif(w, 'All caught up', 18, { color: C.muted });
		const list = column(w, family === 'medium' ? 7 : 9);
		t.tasks.slice(0, family === 'medium' ? 4 : 10).forEach((task) => taskRow(list, task));
		w.addSpacer();
	}
};

function circular(w, value, caption) {
	w.addAccessoryWidgetBackground = true;
	const s = column(w);
	s.centerAlignContent();
	const top = row(s);
	top.addSpacer();
	text(top, String(value), {
		font: new Font(SERIF, String(value).length > 3 ? 13 : 20),
		scale: 0.5
	});
	top.addSpacer();
	if (caption) {
		const bottom = row(s);
		bottom.addSpacer();
		text(bottom, caption.toUpperCase(), { font: Font.mediumSystemFont(7) });
		bottom.addSpacer();
	}
}

function message(w, family, value) {
	if (isLock(family)) return void text(w, value, { size: 11, lines: 3 });
	label(w, 'Gallery');
	w.addSpacer(6);
	text(w, value, { size: 12, lines: 5, color: C.muted });
}

/** Builds a widget. `parameter` is “<kind> [theme]”. */
async function build(family, parameter, result) {
	const [kindWord, themeWord] = (parameter ?? '').trim().toLowerCase().split(/\s+/);
	const kind = KINDS.includes(kindWord) ? kindWord : 'overview';
	const w = new ListWidget();
	w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

	if (!result.data) {
		C = {
			text: Color.dynamic(Color.black(), Color.white()),
			muted: Color.gray(),
			subtle: Color.gray(),
			border: Color.gray()
		};
		message(w, family, result.problem ?? 'Open Scriptable to finish setting up.');
		return w;
	}

	C = palette(result.data, themeWord || result.data.theme);
	if (!isLock(family)) {
		w.backgroundColor = C.bg;
		w.setPadding(14, 15, 12, 15);
	}
	widgets[kind](w, result.data, family);

	if (result.stale && !isLock(family)) {
		w.addSpacer(2);
		const time = new Date(result.data.generatedAt).toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit'
		});
		text(w, `Offline · updated ${time}`, { size: 8, color: C.subtle });
	}
	return w;
}

// ------------------------------------------------------------------- main

async function main() {
	if (config.runsInWidget || config.runsInAccessoryWidget) {
		const token = storedToken();
		const result = token
			? await load(token)
			: { problem: 'Open Scriptable and run this script once to add your token.' };
		Script.setWidget(await build(config.widgetFamily ?? 'small', args.widgetParameter, result));
		return;
	}

	// Run inside the app: set up the token, then preview any widget.
	let token = storedToken() ?? (await askForToken());
	if (!token) return;
	let result = await load(token);
	if (result.revoked) {
		token = await askForToken('That token was revoked. Paste a new one from Admin → Widgets.');
		if (!token) return;
		result = await load(token);
	}

	const pick = new Alert();
	pick.title = 'Preview a widget';
	pick.message =
		result.problem ?? 'Add widgets from the Home Screen: Scriptable, then this script.';
	const names = {
		overview: 'Overview',
		jobs: 'Jobs',
		money: 'Money',
		activity: 'Activity',
		todo: 'To Do'
	};
	for (const kind of KINDS) pick.addAction(names[kind]);
	pick.addAction('Change Token');
	pick.addCancelAction('Done');
	const choice = await pick.presentSheet();
	if (choice === -1) return;
	if (choice === KINDS.length) {
		await askForToken();
		return;
	}

	const size = new Alert();
	size.title = 'Size';
	['Small', 'Medium', 'Large'].forEach((name) => size.addAction(name));
	size.addCancelAction('Cancel');
	const family = ['small', 'medium', 'large'][await size.presentSheet()];
	if (!family) return;
	const w = await build(family, KINDS[choice], result);
	if (family === 'small') await w.presentSmall();
	else if (family === 'medium') await w.presentMedium();
	else await w.presentLarge();
}

await main();
Script.complete();
