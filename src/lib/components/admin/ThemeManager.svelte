<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Upload from '@lucide/svelte/icons/upload';
	import Download from '@lucide/svelte/icons/download';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ThemeIcon from './ThemeIcon.svelte';
	import { api, feedback } from './feedback.svelte.js';
	import type { ThemeSummary } from '#lib/types.js';

	interface Props {
		themes: ThemeSummary[];
		/** Theme ids in use, with what uses them, so deleting one can say what changes. */
		inUse: Record<string, string>;
	}

	let { themes, inUse }: Props = $props();
	let input = $state<HTMLInputElement>();
	let uploading = $state(false);
	let notes = $state<string[]>([]);
	let deleting = $state<string | null>(null);

	const sources: Record<ThemeSummary['source'], string> = {
		'built-in': 'Built-in',
		custom: 'Uploaded',
		replaced: 'Uploaded, replaces built-in'
	};

	interface UploadResult {
		saved: {
			id: string;
			file: string;
			replaced: 'built-in' | 'upload' | null;
			warnings: string[];
		}[];
		failed: { file: string; error: string }[];
	}

	async function upload(files: FileList | null) {
		if (!files?.length) return;
		const body = new FormData();
		for (const file of files) body.append('themes', file);
		uploading = true;
		notes = [];
		try {
			const response = await fetch('/admin/api/themes', { method: 'POST', body });
			const result = (await response.json().catch(() => ({}))) as UploadResult & {
				message?: string;
			};
			if (!response.ok) throw new Error(result.message ?? 'The upload failed.');
			notes = [
				...result.failed.map((f) => `${f.file}: ${f.error}`),
				...result.saved.flatMap((s) => s.warnings.map((w) => `${s.file}: ${w}`))
			];
			if (result.saved.length) {
				await invalidateAll();
				const names = result.saved.map((s) => s.id).join(', ');
				const updated = result.saved.some((s) => s.replaced);
				feedback.toast(`${updated ? 'Updated' : 'Added'} ${names}`);
			} else {
				feedback.toast('No themes were added', 'error');
			}
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			uploading = false;
			if (input) input.value = '';
		}
	}

	async function remove(theme: ThemeSummary) {
		const uses = inUse[theme.id];
		const ok = await feedback.confirm({
			title: `Delete “${theme.name}”?`,
			message:
				(theme.source === 'replaced'
					? 'The built-in theme with the same name comes back.'
					: 'The theme file is deleted from the server.') +
				(uses && theme.source !== 'replaced'
					? ` It’s used for ${uses}, which will go back to the default theme.`
					: '') +
				' Invoices that used it are drawn in the default style.',
			confirmLabel: 'Delete theme',
			danger: true
		});
		if (!ok) return;
		deleting = theme.id;
		try {
			await api(`/admin/api/themes/${theme.id}`, undefined, 'DELETE');
			await invalidateAll();
			feedback.toast(`Deleted ${theme.name}`);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			deleting = null;
		}
	}
</script>

<div class="manager">
	<div class="manager-head">
		<span class="label">Theme files</span>
		<input
			bind:this={input}
			type="file"
			accept=".json,application/json"
			multiple
			class="visually-hidden"
			onchange={(event) => upload(event.currentTarget.files)}
			tabindex="-1"
			aria-hidden="true"
		/>
		<button
			type="button"
			class="btn btn-sm btn-quiet"
			onclick={() => input?.click()}
			disabled={uploading}
		>
			{#if uploading}<span class="spinner"></span>{:else}<Upload size={13} />{/if}
			Upload Theme
		</button>
	</div>

	{#if notes.length}
		<ul class="alert alert-error notes">
			{#each notes as note, i (i)}<li>{note}</li>{/each}
		</ul>
	{/if}

	<ul class="list">
		{#each themes as theme (theme.id)}
			<li>
				<span
					class="dot"
					style:background={theme.swatch.bg}
					style:border-color={theme.swatch.border}
				>
					<span style:background={theme.swatch.accent}></span>
				</span>
				<div class="info">
					<span class="name"><ThemeIcon name={theme.icon} size={13} /> {theme.name}</span>
					<span class="ui-sub">
						{[
							`${theme.id}.json`,
							sources[theme.source],
							inUse[theme.id] && `used for ${inUse[theme.id]}`
						]
							.filter(Boolean)
							.join(' · ')}
					</span>
				</div>
				<div class="ui-row-actions">
					<a
						class="ui-icon-btn"
						href="/admin/api/themes/{theme.id}"
						download="{theme.id}.json"
						title="Download {theme.id}.json"
						aria-label="Download {theme.name}"
					>
						<Download size={15} strokeWidth={1.5} />
					</a>
					{#if theme.source !== 'built-in'}
						<button
							type="button"
							class="ui-icon-btn danger"
							onclick={() => remove(theme)}
							disabled={deleting === theme.id}
							title="Delete"
							aria-label="Delete {theme.name}"
						>
							{#if deleting === theme.id}<span class="spinner"></span>{:else}<Trash2
									size={15}
									strokeWidth={1.5}
								/>{/if}
						</button>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
	<p class="hint">
		Upload <code>.json</code> theme files; the file name becomes the theme’s id. Download a built-in theme
		to use as a starting point. Uploading a file with an existing theme’s name updates it.
	</p>
</div>

<style>
	.manager {
		display: grid;
		gap: 0.85rem;
		padding-top: 1.25rem;
		border-top: 1px solid var(--border);
	}

	.manager-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.notes {
		margin: 0;
		padding-left: 2rem;
		display: grid;
		gap: 0.25rem;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--border);
	}

	.list li {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.list li:last-child {
		border-bottom: 0;
	}

	.dot {
		position: relative;
		flex: none;
		width: 28px;
		height: 28px;
		border: 1px solid;
	}

	.dot span {
		position: absolute;
		right: 4px;
		bottom: 4px;
		width: 8px;
		height: 8px;
	}

	.info {
		display: grid;
		flex: 1;
		min-width: 0;
	}

	.name {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
	}

	code {
		background: var(--surface);
		padding: 0 0.3rem;
	}
</style>
