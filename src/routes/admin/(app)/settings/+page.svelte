<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ThemePicker from '#lib/components/admin/ThemePicker.svelte';
	import ThemeManager from '#lib/components/admin/ThemeManager.svelte';
	import Toggle from '#lib/components/admin/Toggle.svelte';
	import { feedback } from '#lib/components/admin/feedback.svelte.js';
	import type { Layout, SortOrder } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const initial = untrack(() => data.current);
	let theme = $state(initial.theme);
	let accent = $state(initial.defaultAccentColor);
	let layout = $state<Layout>(initial.defaultLayout);
	let sort = $state<SortOrder>(initial.defaultSort);
	let showContactOnHome = $state(initial.showContactOnHome);
	let defaultPublic = $state(initial.defaultPublic);
	let defaultShowOnHome = $state(initial.defaultShowOnHome);
	let preview = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement>();
	let saving = $state(false);

	const heroSrc = $derived(
		preview ?? (data.current.heroImage ? `/site/hero/small?v=${data.current.heroImage}` : null)
	);

	function onfile(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		if (preview) URL.revokeObjectURL(preview);
		preview = file ? URL.createObjectURL(file) : null;
	}

	const sections = [
		{ id: 'branding', label: 'Branding' },
		{ id: 'homepage', label: 'Homepage' },
		{ id: 'contact', label: 'Contact' },
		{ id: 'appearance', label: 'Appearance' },
		{ id: 'defaults', label: 'Album defaults' }
	];
</script>

<svelte:head>
	<title>Settings — {data.settings.siteTitle}</title>
</svelte:head>

<header class="head">
	<p class="eyebrow">Configuration</p>
	<h1>Settings</h1>
	<nav class="jump">
		{#each sections as section (section.id)}
			<a href="#{section.id}">{section.label}</a>
		{/each}
	</nav>
</header>

<form
	method="POST"
	action="?/save"
	enctype="multipart/form-data"
	use:enhance={({ action }) => {
		saving = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			saving = false;
			if (result.type === 'success') {
				if (action.search.includes('testWebhook')) feedback.toast('Test message sent to Discord');
				else if (action.search.includes('removeHero')) feedback.toast('Hero image removed');
				else feedback.toast('Settings saved');
				if (fileInput) fileInput.value = '';
				if (preview) URL.revokeObjectURL(preview);
				preview = null;
			} else if (result.type === 'failure') {
				feedback.toast(String(result.data?.error ?? 'Please check the form'), 'error');
			} else if (result.type === 'error') {
				feedback.toast('Something went wrong', 'error');
			}
		};
	}}
>
	<section class="card" id="branding">
		<div class="card-head">
			<h2>Branding</h2>
			<p class="hint">How your site is named across every page.</p>
		</div>

		<div class="field">
			<span class="label">Hero image</span>
			<div class="hero-picker">
				<div class="hero-preview">
					{#if heroSrc}
						<img src={heroSrc} alt="Hero preview" />
					{:else}
						<span><ImageIcon size={22} strokeWidth={1} /> No hero image</span>
					{/if}
				</div>
				<div class="hero-actions">
					<input
						bind:this={fileInput}
						type="file"
						name="heroImage"
						accept="image/jpeg,image/png,image/webp,image/gif"
						onchange={onfile}
						class="file"
					/>
					<p class="hint">Recommended around 2400 × 1600 pixels, landscape. Saved with the form.</p>
					{#if data.current.heroImage && !preview}
						<button class="link danger" formaction="?/removeHero" formnovalidate
							>Remove hero image</button
						>
					{/if}
				</div>
			</div>
		</div>

		<div class="grid-2">
			<div class="field">
				<label for="siteTitle">Site title</label>
				<input
					id="siteTitle"
					class="input"
					name="siteTitle"
					value={data.current.siteTitle}
					required
				/>
			</div>
			<div class="field">
				<label for="copyright">Copyright text</label>
				<input id="copyright" class="input" name="copyright" value={data.current.copyright} />
				<p class="hint"><code>{'{year}'}</code> is replaced with the current year.</p>
			</div>
		</div>
	</section>

	<section class="card" id="homepage">
		<div class="card-head">
			<h2>Homepage content</h2>
			<p class="hint">Line breaks are kept — use them to shape headings and paragraphs.</p>
		</div>
		<div class="field">
			<label for="heroTitle">Hero title</label>
			<textarea id="heroTitle" class="textarea short" name="heroTitle" rows="3"
				>{data.current.heroTitle}</textarea
			>
			<p class="hint">
				Each line becomes a line of the headline; alternate lines are set in italics.
			</p>
		</div>
		<div class="field">
			<label for="heroDescription">Hero description</label>
			<textarea id="heroDescription" class="textarea short" name="heroDescription" rows="3"
				>{data.current.heroDescription}</textarea
			>
		</div>
		<div class="field">
			<label for="galleriesIntro">Galleries page introduction</label>
			<textarea id="galleriesIntro" class="textarea short" name="galleriesIntro" rows="2"
				>{data.current.galleriesIntro}</textarea
			>
		</div>
		<div class="field">
			<label for="aboutTitle">About section title</label>
			<input id="aboutTitle" class="input" name="aboutTitle" value={data.current.aboutTitle} />
		</div>
		<div class="field">
			<label for="aboutText">About section text</label>
			<textarea id="aboutText" class="textarea" name="aboutText" rows="7"
				>{data.current.aboutText}</textarea
			>
			<p class="hint">
				Separate paragraphs with a blank line. The first paragraph is shown larger.
			</p>
		</div>
	</section>

	<section class="card" id="contact">
		<div class="card-head">
			<h2>Contact & integrations</h2>
			<p class="hint">Contact details also appear on expired galleries.</p>
		</div>
		<div class="grid-2">
			<div class="field">
				<label for="contactEmail">Contact email</label>
				<input
					id="contactEmail"
					class="input"
					type="email"
					name="contactEmail"
					value={data.current.contactEmail}
				/>
			</div>
			<div class="field">
				<label for="contactPhone">Contact phone</label>
				<input
					id="contactPhone"
					class="input"
					type="tel"
					name="contactPhone"
					value={data.current.contactPhone}
				/>
			</div>
		</div>
		<Toggle
			name="showContactOnHome"
			label="Show contact details on the homepage"
			description="Displayed beneath the About section."
			bind:checked={showContactOnHome}
		/>
		<div class="field">
			<label for="discordWebhook">Discord webhook URL <span class="optional">optional</span></label>
			<div class="inline">
				<input
					id="discordWebhook"
					class="input"
					type="url"
					name="discordWebhook"
					value={data.current.discordWebhook}
					placeholder="https://discord.com/api/webhooks/…"
				/>
				<button class="btn btn-sm btn-quiet" formaction="?/testWebhook" formnovalidate
					>Send test</button
				>
			</div>
			<p class="hint">Get notified in Discord when clients download photos or full albums.</p>
		</div>
	</section>

	<section class="card" id="appearance">
		<div class="card-head">
			<h2>Appearance</h2>
			<p class="hint">Applies to the public site and this dashboard.</p>
		</div>
		<ThemePicker themes={data.themes} name="theme" bind:value={theme} />
		<p class="hint">
			Invoices have their own style setting under
			<a href="/admin/invoices/settings">Invoices → Settings</a>.
		</p>
		<ThemeManager themes={data.themes} inUse={data.themesInUse} />
	</section>

	<section class="card" id="defaults">
		<div class="card-head">
			<h2>Album defaults</h2>
			<p class="hint">Starting values for newly created albums.</p>
		</div>
		<div class="field">
			<label for="defaultDescription">Default description</label>
			<textarea
				id="defaultDescription"
				class="textarea"
				name="defaultDescription"
				rows="4"
				placeholder="Markdown supported">{data.current.defaultDescription}</textarea
			>
		</div>
		<div class="grid-3">
			<div class="field">
				<span class="label">Accent colour</span>
				<div class="inline">
					<input
						type="color"
						class="swatch-input"
						bind:value={accent}
						aria-label="Default accent colour"
					/>
					<input
						class="input hex"
						name="defaultAccentColor"
						bind:value={accent}
						aria-label="Default accent hex"
					/>
				</div>
			</div>
			<div class="field">
				<label for="defaultLayout">Layout</label>
				<select id="defaultLayout" class="select" name="defaultLayout" bind:value={layout}>
					<option value="grid">Grid</option>
					<option value="masonry">Masonry</option>
				</select>
			</div>
			<div class="field">
				<label for="defaultSort">Sort order</label>
				<select id="defaultSort" class="select" name="defaultSort" bind:value={sort}>
					<option value="oldest">Oldest first</option>
					<option value="newest">Newest first</option>
					<option value="random">Random</option>
				</select>
			</div>
		</div>
		<div class="toggles">
			<Toggle name="defaultPublic" label="Public by default" bind:checked={defaultPublic} />
			<Toggle
				name="defaultShowOnHome"
				label="Show on homepage by default"
				bind:checked={defaultShowOnHome}
			/>
		</div>
	</section>

	<div class="submit">
		<button class="btn btn-solid" disabled={saving}>
			{#if saving}<span class="spinner"></span>{/if} Save Settings
		</button>
	</div>
</form>

<style>
	.head {
		margin-bottom: 2rem;
	}

	h1 {
		font-size: clamp(2.2rem, 4vw, 3rem);
		margin: 0.5rem 0 1.25rem;
	}

	.jump {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
	}

	.jump a {
		font-size: 0.68rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		text-decoration: none;
		color: var(--text-muted);
	}

	.jump a:hover {
		color: var(--text);
	}

	form {
		display: grid;
		gap: 1.5rem;
		max-width: 860px;
	}

	.card {
		display: grid;
		gap: 1.4rem;
		padding: clamp(1.25rem, 3vw, 2rem);
		border: 1px solid var(--border);
		background: var(--bg-elevated);
		scroll-margin-top: 1.5rem;
	}

	.card-head {
		display: grid;
		gap: 0.35rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border);
	}

	.card-head h2 {
		font-size: 1.5rem;
	}

	.grid-2,
	.grid-3 {
		display: grid;
		gap: 1.25rem;
	}

	@media (min-width: 720px) {
		.grid-2 {
			grid-template-columns: 1fr 1fr;
		}

		.grid-3 {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.textarea.short {
		min-height: 80px;
	}

	.optional {
		text-transform: none;
		letter-spacing: 0;
		color: var(--text-subtle);
		margin-left: 0.3rem;
	}

	code {
		background: var(--surface);
		padding: 0 0.3rem;
	}

	.inline {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.hero-picker {
		display: grid;
		gap: 1.25rem;
	}

	@media (min-width: 720px) {
		.hero-picker {
			grid-template-columns: 320px minmax(0, 1fr);
			align-items: start;
		}
	}

	.hero-preview {
		aspect-ratio: 3 / 2;
		display: grid;
		place-items: center;
		background: var(--placeholder);
		border: 1px solid var(--border);
		overflow: hidden;
		color: var(--text-subtle);
		font-size: 0.82rem;
	}

	.hero-preview span {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.hero-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.hero-actions {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
	}

	.file {
		font-size: 0.85rem;
		max-width: 100%;
	}

	.file::file-selector-button {
		margin-right: 0.85rem;
		padding: 0.55rem 1rem;
		border: 1px solid var(--text);
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 0.66rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.link.danger {
		color: var(--danger);
	}

	.swatch-input {
		width: 44px;
		height: 44px;
		padding: 0;
		border: 1px solid var(--border);
		background: none;
		cursor: pointer;
		flex: none;
	}

	.hex {
		font-family: ui-monospace, monospace;
		font-size: 0.86rem;
	}

	.toggles {
		display: grid;
		gap: 1rem;
	}

	.submit {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		padding-block: 1rem;
		background: linear-gradient(to top, var(--bg) 70%, transparent);
	}
</style>
