<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Copy from '@lucide/svelte/icons/copy';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import WidgetPreview from '#lib/components/admin/WidgetPreview.svelte';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import type { WidgetFamily, WidgetKind } from '#lib/types.js';
	import { formatDateTime } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const SCRIPTABLE = 'https://apps.apple.com/app/scriptable/id1405459188';

	let name = $state('iPhone widgets');
	let creating = $state(false);
	/** The token just made, and the script with it filled in: shown once, then gone for good. */
	let fresh = $state<{ token: string; script: string } | null>(null);

	let family = $state<WidgetFamily | 'lock'>('small');
	/** '' is the site's theme, which the widget uses when the parameter doesn't name one. */
	let theme = $state('');

	const kinds: { id: WidgetKind; name: string; description: string }[] = [
		{
			id: 'overview',
			name: 'Overview',
			description: 'The next job, money outstanding and this week’s gallery activity.'
		},
		{
			id: 'jobs',
			name: 'Jobs',
			description: 'What’s coming up, with dates, times and places. Tap a job to open it.'
		},
		{
			id: 'money',
			name: 'Money',
			description: 'Outstanding and overdue invoices, and what’s been paid this month and tax year.'
		},
		{
			id: 'activity',
			name: 'Activity',
			description: 'Views and downloads this week against last, by day, and the busiest galleries.'
		},
		{
			id: 'todo',
			name: 'To do',
			description: 'Overdue invoices, jobs to deliver and jobs to invoice, as on the dashboard.'
		}
	];

	const sizes: { id: WidgetFamily | 'lock'; label: string }[] = [
		{ id: 'small', label: 'Small' },
		{ id: 'medium', label: 'Medium' },
		{ id: 'large', label: 'Large' },
		{ id: 'lock', label: 'Lock Screen' }
	];

	const themeChoices = $derived([
		{ id: '', label: `Site (${data.widget.themes[data.widget.theme]?.name ?? 'default'})` },
		...Object.entries(data.widget.themes)
			.filter(([id]) => id !== data.widget.theme)
			.map(([id, t]) => ({ id, label: t.name })),
		{ id: 'auto', label: 'Auto' }
	]);

	const previewTheme = $derived(theme === '' || theme === 'auto' ? data.widget.theme : theme);
	const parameter = (kind: WidgetKind) => (theme ? `${kind} ${theme}` : kind);

	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			feedback.toast(`${what} copied`);
		} catch {
			feedback.toast(
				`Couldn’t copy the ${what.toLowerCase()}. Select it and copy it by hand.`,
				'error'
			);
		}
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		creating = true;
		try {
			fresh = await api<{ token: string; script: string }>('/admin/api/widgets', {
				action: 'create-token',
				name
			});
			await invalidate('admin:widgets');
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			creating = false;
		}
	}

	async function revoke(token: (typeof data.tokens)[number]) {
		const ok = await feedback.confirm({
			title: `Revoke “${token.name}”?`,
			message:
				'Widgets using this token stop updating. Run the script in Scriptable to give them a new one.',
			confirmLabel: 'Revoke Token',
			danger: true
		});
		if (!ok) return;
		try {
			await api('/admin/api/widgets', { action: 'revoke-token', id: token.id });
			await invalidate('admin:widgets');
			feedback.toast(`Revoked “${token.name}”`);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		}
	}
</script>

<svelte:head>
	<title>Widgets — {data.settings.siteTitle}</title>
</svelte:head>

<header class="head">
	<p class="eyebrow">Apps</p>
	<h1>Widgets</h1>
	<p class="muted intro">
		Put your jobs, money and gallery activity on your iPhone’s Home Screen and Lock Screen. The
		widgets run in Scriptable, a free app, and refresh every 15 minutes or so.
	</p>
</header>

<div class="steps">
	<section class="ui-card">
		<div class="ui-card-head">
			<p class="eyebrow">Step 1</p>
			<h2>Install Scriptable</h2>
		</div>
		<div>
			<a class="btn btn-solid" href={SCRIPTABLE} target="_blank" rel="noopener">
				<ExternalLink size={14} strokeWidth={1.5} /> Get Scriptable
			</a>
		</div>
		<p class="hint">It’s free on the App Store and runs small scripts as widgets.</p>
	</section>

	<section class="ui-card">
		<div class="ui-card-head">
			<p class="eyebrow">Step 2</p>
			<h2>Make a token and copy the script</h2>
			<p class="hint">
				A widget token can only read the summary the widgets show. It can’t change anything, see
				client galleries or publish.
			</p>
		</div>

		{#if fresh}
			<div class="fresh">
				<span class="fresh-label">Ready to paste</span>
				<p>The script below has your new token in it, so there’s nothing else to enter.</p>
				<div class="buttons">
					<button class="btn btn-solid" onclick={() => copy(fresh!.script, 'Script')}>
						<Copy size={14} strokeWidth={1.5} /> Copy Script
					</button>
					<button class="btn btn-quiet" onclick={() => copy(fresh!.token, 'Token')}>
						<Copy size={14} strokeWidth={1.5} /> Copy Token Only
					</button>
				</div>
				<p class="hint">
					The token won’t be shown again. If you lose it, make another; the script asks for it when
					it’s missing.
				</p>
			</div>
		{/if}

		<form class="copy-row" onsubmit={create}>
			<input
				class="input"
				bind:value={name}
				aria-label="Token name"
				placeholder="iPhone widgets"
				maxlength="100"
			/>
			<button class="btn btn-quiet" disabled={creating}>
				{#if creating}<span class="spinner"></span>{:else}<KeyRound
						size={14}
						strokeWidth={1.5}
					/>{/if} Make Token
			</button>
		</form>

		<ol class="how">
			<li>On your iPhone, make a token here, then tap Copy Script.</li>
			<li>
				In Scriptable, tap <strong>+</strong>, paste, and tap the title at the top to name it
				<code>Gallery</code>.
			</li>
			<li>
				Tap ▶ to run it once. It checks it can reach the site and lets you preview every widget.
			</li>
		</ol>

		{#if data.tokens.length}
			<div class="ui-table-wrap tokens">
				<table class="ui-table">
					<thead>
						<tr>
							<th>Token</th>
							<th>Made</th>
							<th>Last used</th>
							<th class="ui-shrink"><span class="visually-hidden">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						{#each data.tokens as token (token.id)}
							<tr>
								<td>{token.name}</td>
								<td class="when">{formatDateTime(token.createdAt)}</td>
								<td class="when">
									{token.lastUsedAt ? formatDateTime(token.lastUsedAt) : 'Not yet'}
								</td>
								<td class="ui-shrink">
									<button
										class="ui-icon-btn danger"
										onclick={() => revoke(token)}
										title="Revoke"
										aria-label="Revoke {token.name}"
									>
										<Trash2 size={15} strokeWidth={1.5} />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<details class="script">
			<summary>The script without a token</summary>
			<p class="hint">
				For a second phone, or after a site update changes the widgets: paste this over the old
				script. It uses the token already saved on the phone, or asks for one.
			</p>
			<div>
				<button class="btn btn-sm btn-quiet" onclick={() => copy(data.script, 'Script')}>
					<Copy size={14} strokeWidth={1.5} /> Copy Script
				</button>
			</div>
			<pre>{data.script}</pre>
		</details>
	</section>

	<section class="ui-card">
		<div class="ui-card-head">
			<p class="eyebrow">Step 3</p>
			<h2>Add widgets</h2>
		</div>
		<div class="ui-grid-2 places">
			<div>
				<h3>Home Screen</h3>
				<ol class="how">
					<li>Touch and hold the Home Screen, tap Edit, then Add Widget.</li>
					<li>Choose Scriptable, pick a size and tap Add Widget.</li>
					<li>
						Touch and hold the new widget, tap Edit Widget, set Script to <code>Gallery</code> and Parameter
						to one of the options below.
					</li>
				</ol>
			</div>
			<div>
				<h3>Lock Screen</h3>
				<ol class="how">
					<li>Touch and hold the Lock Screen, tap Customise, then Lock Screen.</li>
					<li>Tap the widget area, choose Scriptable and a shape.</li>
					<li>Tap the widget to set Script and Parameter the same way.</li>
				</ol>
			</div>
		</div>
		<p class="hint">
			Add as many as you like, each with its own parameter. Tapping a widget opens the matching page
			here in Safari.
		</p>
	</section>

	<section class="ui-card">
		<div class="ui-card-head">
			<h2>Widget options</h2>
			<p class="hint">
				Previews use your live data. Type the parameter shown under each one into Edit Widget.
			</p>
		</div>

		<div class="controls">
			<div class="segmented" role="radiogroup" aria-label="Size">
				{#each sizes as size (size.id)}
					<button
						role="radio"
						aria-checked={family === size.id}
						class:active={family === size.id}
						onclick={() => (family = size.id)}
					>
						{size.label}
					</button>
				{/each}
			</div>
			<div class="segmented" role="radiogroup" aria-label="Colours">
				{#each themeChoices as choice (choice.id)}
					<button
						role="radio"
						aria-checked={theme === choice.id}
						class:active={theme === choice.id}
						onclick={() => (theme = choice.id)}
					>
						{choice.label}
					</button>
				{/each}
			</div>
			{#if theme === 'auto'}
				<p class="hint">
					Auto follows the phone: your site’s light and dark themes in Light and Dark Mode.
				</p>
			{/if}
			{#if family === 'lock'}
				<p class="hint">
					The Lock Screen tints widgets itself, so colours don’t apply there. Rectangular, round and
					inline (above the clock) are shown.
				</p>
			{/if}
		</div>

		<div class="options" class:wide={family === 'medium' || family === 'large'}>
			{#each kinds as kind (kind.id)}
				<article class="option">
					<div class="previews">
						{#if family === 'lock'}
							<WidgetPreview
								data={data.widget}
								kind={kind.id}
								family="rectangular"
								theme={previewTheme}
							/>
							<WidgetPreview
								data={data.widget}
								kind={kind.id}
								family="circular"
								theme={previewTheme}
							/>
							<WidgetPreview
								data={data.widget}
								kind={kind.id}
								family="inline"
								theme={previewTheme}
							/>
						{:else}
							<WidgetPreview data={data.widget} kind={kind.id} {family} theme={previewTheme} />
						{/if}
					</div>
					<div class="option-text">
						<h3>{kind.name}</h3>
						<p class="hint">{kind.description}</p>
						<div class="param">
							<span class="param-label">Parameter</span>
							<code>{family === 'lock' ? kind.id : parameter(kind.id)}</code>
							<button
								class="ui-icon-btn"
								onclick={() => copy(family === 'lock' ? kind.id : parameter(kind.id), 'Parameter')}
								title="Copy"
								aria-label="Copy the {kind.name} parameter"
							>
								<Copy size={14} strokeWidth={1.5} />
							</button>
						</div>
					</div>
				</article>
			{/each}
		</div>
	</section>
</div>

<style>
	.head {
		margin-bottom: 2rem;
		max-width: 760px;
	}

	h1 {
		font-size: clamp(2.2rem, 4vw, 3rem);
		margin: 0.5rem 0 1rem;
	}

	h3 {
		font-size: 1.15rem;
		margin-bottom: 0.6rem;
	}

	.intro {
		line-height: 1.7;
	}

	.steps {
		display: grid;
		gap: 1.5rem;
		max-width: 980px;
	}

	.how {
		display: grid;
		gap: 0.6rem;
		margin: 0;
		padding-left: 1.2rem;
		color: var(--text-muted);
		line-height: 1.6;
	}

	code,
	pre {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.86em;
	}

	code {
		background: var(--surface);
		padding: 0 0.3rem;
	}

	.copy-row {
		display: flex;
		gap: 0.5rem;
	}

	.copy-row .input {
		flex: 1;
		min-width: 0;
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.fresh {
		display: grid;
		gap: 0.6rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--success) 50%, transparent);
		background: var(--success-soft);
	}

	.fresh p {
		margin: 0;
	}

	.fresh-label,
	.param-label {
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.tokens {
		border: 1px solid var(--border);
	}

	.when {
		white-space: nowrap;
		color: var(--text-muted);
		font-size: 0.82rem;
	}

	.script {
		display: grid;
		gap: 0.75rem;
		border-top: 1px solid var(--border);
		padding-top: 1rem;
	}

	.script summary {
		cursor: pointer;
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.script[open] summary {
		margin-bottom: 0.75rem;
	}

	.script > * + * {
		margin-top: 0.75rem;
	}

	pre {
		max-height: 320px;
		overflow: auto;
		margin: 0;
		padding: 1rem;
		border: 1px solid var(--border);
		background: var(--surface);
		font-size: 0.75rem;
		line-height: 1.5;
	}

	.places h3 {
		margin-bottom: 0.75rem;
	}

	.controls {
		display: grid;
		gap: 0.75rem;
	}

	.segmented {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		border: 1px solid var(--border);
		width: fit-content;
		max-width: 100%;
	}

	.segmented button {
		padding: 0.55rem 0.9rem;
		border: 0;
		border-right: 1px solid var(--border);
		background: none;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.66rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		cursor: pointer;
		transition:
			background-color 0.2s var(--ease),
			color 0.2s var(--ease);
	}

	.segmented button:last-child {
		border-right: 0;
	}

	.segmented button:hover {
		color: var(--text);
	}

	.segmented button.active {
		background: var(--surface);
		color: var(--text);
	}

	.options {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
		gap: 2rem 1.5rem;
	}

	.options.wide {
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
	}

	.option {
		display: grid;
		align-content: start;
		gap: 1rem;
		min-width: 0;
	}

	.previews {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.option-text h3 {
		margin-bottom: 0.25rem;
	}

	.option-text .hint {
		margin: 0 0 0.6rem;
	}

	.param {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	@media (max-width: 520px) {
		.copy-row {
			flex-wrap: wrap;
		}
	}
</style>
