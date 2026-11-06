<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Grid2x2 from '@lucide/svelte/icons/grid-2x2';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Toggle from './Toggle.svelte';
	import { feedback } from './feedback.svelte.js';
	import { slugify } from '#lib/utils.js';
	import type { AlbumFormInitial, Layout, SortOrder } from '#lib/types.js';

	interface Props {
		mode: 'create' | 'edit';
		initial: AlbumFormInitial;
		origin: string;
		action?: string;
		error?: string | null;
		errorField?: string | null;
		hasPassword?: boolean;
		onsaved?: () => void;
	}

	let {
		mode,
		initial,
		origin,
		action = '',
		error = null,
		errorField = null,
		hasPassword = false,
		onsaved
	}: Props = $props();

	const start = untrack(() => initial);

	let title = $state(start.title);
	let slug = $state(start.slug);
	let slugTouched = $state(untrack(() => mode === 'edit') || !!start.slug);
	let description = $state(start.description);
	let albumDate = $state(start.albumDate);
	let isPublic = $state(start.isPublic);
	let showOnHome = $state(start.showOnHome);
	let showOnGalleries = $state(start.showOnGalleries);
	let isFeatured = $state(start.isFeatured);
	let passwordEnabled = $state(start.passwordEnabled);
	let password = $state('');
	let expiresLocal = $state('');
	let accentColor = $state(start.accentColor);
	let layout = $state<Layout>(start.layout);
	let sortOrder = $state<SortOrder>(start.sortOrder);
	let saving = $state(false);

	const effectiveSlug = $derived(slugTouched ? slugify(slug) : slugify(title));
	const expiresIso = $derived.by(() => {
		if (!expiresLocal) return '';
		const date = new Date(expiresLocal);
		return isNaN(date.getTime()) ? '' : date.toISOString();
	});

	function toLocalInput(iso: string) {
		const date = new Date(iso);
		if (isNaN(date.getTime())) return '';
		return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
	}

	// datetime-local values depend on the browser's timezone, so they're filled in after hydration.
	onMount(() => {
		if (start.expiresAt) expiresLocal = toLocalInput(start.expiresAt);
	});

	const layouts: { value: Layout; label: string; hint: string; icon: typeof Grid2x2 }[] = [
		{ value: 'grid', label: 'Grid', hint: 'Uniform square thumbnails', icon: Grid2x2 },
		{ value: 'masonry', label: 'Masonry', hint: 'Natural aspect ratios', icon: LayoutGrid }
	];

	const sorts: { value: SortOrder; label: string }[] = [
		{ value: 'oldest', label: 'Oldest' },
		{ value: 'newest', label: 'Newest' },
		{ value: 'random', label: 'Random' }
	];

	const PRESETS = ['#26231f', '#8b6f47', '#a0522d', '#6b7a5a', '#4a6274', '#7d4e57', '#b08d57'];
</script>

<form
	method="POST"
	{action}
	class="album-form"
	use:enhance={() => {
		saving = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			saving = false;
			if (result.type === 'success') {
				password = '';
				feedback.toast('Album saved');
				onsaved?.();
			} else if (result.type === 'failure') {
				feedback.toast(String(result.data?.error ?? 'Please check the form'), 'error');
			} else if (result.type === 'error') {
				feedback.toast('Something went wrong while saving', 'error');
			}
		};
	}}
>
	<section class="group">
		<h3>Album information</h3>
		<div class="field">
			<label for="title">Title</label>
			<input
				id="title"
				class="input"
				name="title"
				bind:value={title}
				required
				maxlength="200"
				placeholder="e.g. Emma & James — Wedding"
				aria-invalid={errorField === 'title'}
			/>
		</div>

		<div class="field">
			<label for="slug">URL slug</label>
			<div class="slug-input">
				<span class="prefix">/</span>
				<input
					id="slug"
					class="input"
					name="slug"
					value={effectiveSlug}
					oninput={(event) => {
						slugTouched = true;
						slug = event.currentTarget.value;
					}}
					placeholder="emma-and-james"
					aria-invalid={errorField === 'slug'}
				/>
			</div>
			<p class="hint">
				Album URL: <span class="url">{origin}/{effectiveSlug || '…'}</span>
			</p>
		</div>

		<div class="field">
			<label for="description">Description</label>
			<textarea
				id="description"
				class="textarea"
				name="description"
				rows="5"
				bind:value={description}
				placeholder="A few words about the session. Markdown is supported: **bold**, *italic*, [links](https://…), lists and quotes."
			></textarea>
			<p class="hint">Supports Markdown formatting.</p>
		</div>

		{#if mode === 'edit'}
			<div class="field narrow">
				<label for="album_date">Album date</label>
				<input id="album_date" class="input" type="date" name="album_date" bind:value={albumDate} />
			</div>
		{/if}
	</section>

	<section class="group">
		<h3>Visibility</h3>
		<div class="toggles">
			<Toggle
				name="is_public"
				label="Public"
				description="Anyone with the link can view. Private albums are only visible to you."
				bind:checked={isPublic}
			/>
			<Toggle
				name="show_on_home"
				label="Show on homepage"
				description="List this album in the homepage “Explore More” section."
				bind:checked={showOnHome}
			/>
			{#if mode === 'edit'}
				<input type="hidden" name="show_on_galleries_present" value="1" />
				<input type="hidden" name="is_featured_present" value="1" />
				<Toggle
					name="show_on_galleries"
					label="Show on galleries page"
					description="Include this album on the public /galleries listing."
					bind:checked={showOnGalleries}
				/>
				<Toggle
					name="is_featured"
					label="Featured on homepage"
					description="Show this album’s photos in the homepage feature. Only one album can be featured."
					bind:checked={isFeatured}
				/>
			{/if}
		</div>
	</section>

	<section class="group">
		<h3>Access</h3>
		<div class="toggles">
			<Toggle
				name="password_enabled"
				label="Password protection"
				description="Visitors must enter a password to view and download."
				bind:checked={passwordEnabled}
			/>
		</div>
		{#if passwordEnabled}
			<div class="field narrow">
				<label for="password">{hasPassword ? 'Change password' : 'Password'}</label>
				<input
					id="password"
					class="input"
					type="text"
					name="password"
					bind:value={password}
					autocomplete="off"
					placeholder={hasPassword
						? 'Leave blank to keep the current password'
						: 'Choose a password'}
					aria-invalid={errorField === 'password'}
				/>
			</div>
		{/if}

		{#if mode === 'edit'}
			<div class="field narrow">
				<label for="expires">Expires</label>
				<div class="inline">
					<input id="expires" class="input" type="datetime-local" bind:value={expiresLocal} />
					{#if expiresLocal}
						<button type="button" class="link" onclick={() => (expiresLocal = '')}>Clear</button>
					{/if}
				</div>
				<input type="hidden" name="expires_at" value={expiresIso} />
				<p class="hint">After this date visitors see an “expired” notice. You can still view it.</p>
			</div>
		{/if}
	</section>

	<section class="group">
		<h3>Appearance</h3>
		<div class="field">
			<span class="label">Accent colour</span>
			<div class="colors">
				<input
					type="color"
					class="swatch-input"
					bind:value={accentColor}
					aria-label="Pick accent colour"
				/>
				<input
					class="input hex"
					name="accent_color"
					bind:value={accentColor}
					pattern="#[0-9a-fA-F]{'{6}'}"
					aria-label="Accent colour hex value"
				/>
				<div class="presets">
					{#each PRESETS as preset (preset)}
						<button
							type="button"
							class="preset"
							class:current={preset === accentColor.toLowerCase()}
							style:background={preset}
							onclick={() => (accentColor = preset)}
							aria-label="Use {preset}"
						></button>
					{/each}
				</div>
			</div>
			<p class="hint">Used for buttons, selections and active filters in the public album.</p>
		</div>

		<div class="field">
			<span class="label">Gallery layout</span>
			<div class="options two">
				{#each layouts as option (option.value)}
					<label class="option" class:checked={layout === option.value}>
						<input type="radio" name="layout" value={option.value} bind:group={layout} />
						<option.icon size={18} strokeWidth={1.4} />
						<span>
							<strong>{option.label}</strong>
							<small>{option.hint}</small>
						</span>
					</label>
				{/each}
			</div>
		</div>

		<div class="field">
			<span class="label">Default photo order</span>
			<div class="segmented">
				{#each sorts as option (option.value)}
					<label class:checked={sortOrder === option.value}>
						<input type="radio" name="sort_order" value={option.value} bind:group={sortOrder} />
						{option.label}
					</label>
				{/each}
			</div>
		</div>
	</section>

	{#if error}
		<p class="alert alert-error" role="alert">{error}</p>
	{/if}

	<div class="submit">
		<button class="btn btn-solid" disabled={saving}>
			{#if saving}<span class="spinner"></span>{/if}
			{mode === 'create' ? 'Create Album' : 'Save Changes'}
		</button>
	</div>
</form>

<style>
	.album-form {
		display: grid;
		gap: 2.5rem;
	}

	.group {
		display: grid;
		gap: 1.4rem;
	}

	.group h3 {
		font-size: 1.35rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.narrow {
		max-width: 420px;
	}

	.slug-input {
		display: flex;
		align-items: stretch;
	}

	.prefix {
		display: grid;
		place-items: center;
		padding: 0 0.85rem;
		border: 1px solid var(--border);
		border-right: 0;
		background: var(--surface);
		color: var(--text-subtle);
	}

	.url {
		color: var(--text-muted);
		word-break: break-all;
	}

	.toggles {
		display: grid;
		gap: 1.1rem;
	}

	.inline {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.colors {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.swatch-input {
		width: 44px;
		height: 44px;
		padding: 0;
		border: 1px solid var(--border);
		background: none;
		cursor: pointer;
	}

	.swatch-input::-webkit-color-swatch-wrapper {
		padding: 3px;
	}

	.swatch-input::-webkit-color-swatch {
		border: 0;
	}

	.hex {
		width: 120px;
		font-family: ui-monospace, monospace;
		font-size: 0.88rem;
	}

	.presets {
		display: flex;
		gap: 0.4rem;
	}

	.preset {
		width: 26px;
		height: 26px;
		border: 1px solid var(--border);
		cursor: pointer;
		outline-offset: 2px;
	}

	.preset.current {
		outline: 1px solid var(--text);
	}

	.options {
		display: grid;
		gap: 0.75rem;
	}

	.options.two {
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	}

	.option {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--border);
		background: var(--bg-elevated);
		cursor: pointer;
		transition: border-color 0.2s;
	}

	.option:hover {
		border-color: var(--border-strong);
	}

	.option.checked {
		border-color: var(--text);
	}

	.option input,
	.segmented input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.option span {
		display: grid;
	}

	.option strong {
		font-weight: 500;
		font-size: 0.92rem;
	}

	.option small {
		font-size: 0.78rem;
		color: var(--text-subtle);
	}

	.segmented {
		display: inline-flex;
		border: 1px solid var(--border);
		width: fit-content;
	}

	.segmented label {
		padding: 0.6rem 1.1rem;
		font-size: 0.82rem;
		cursor: pointer;
		border-right: 1px solid var(--border);
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.segmented label:last-child {
		border-right: 0;
	}

	.segmented label.checked {
		background: var(--text);
		color: var(--bg);
	}

	.submit {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		padding-block: 1rem;
		background: linear-gradient(to top, var(--bg) 70%, transparent);
	}

	:global(.input[aria-invalid='true']) {
		border-color: var(--danger);
	}
</style>
