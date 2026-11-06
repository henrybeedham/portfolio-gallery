<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { invalidate } from '$app/navigation';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Camera from '@lucide/svelte/icons/camera';
	import FolderInput from '@lucide/svelte/icons/folder-input';
	import { api, feedback } from './feedback.svelte.js';
	import type { JobStatus } from '#lib/types.js';

	interface Props {
		albumId: number;
		photoCount: number;
		initialJob: JobStatus | null;
	}

	let { albumId, photoCount, initialJob }: Props = $props();

	let job = $state<JobStatus | null>(untrack(() => initialJob));
	let scan = $state<{ dir: string; files: number; sample: string[] } | null>(null);
	let scanning = $state(false);
	const running = $derived(job?.status === 'running');

	async function rescan() {
		scanning = true;
		try {
			scan = await api(`/admin/api/albums/${albumId}`, { action: 'import-scan' });
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			scanning = false;
		}
	}

	onMount(rescan);

	async function start(action: string, confirmMessage?: string) {
		if (running) return;
		if (confirmMessage) {
			const ok = await feedback.confirm({
				title: 'Start maintenance task?',
				message: confirmMessage,
				confirmLabel: 'Start'
			});
			if (!ok) return;
		}
		try {
			const result = await api<{ job: JobStatus }>(`/admin/api/albums/${albumId}`, { action });
			job = result.job;
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		}
	}

	// Poll the running job until it finishes.
	$effect(() => {
		if (!job || job.status !== 'running') return;
		const id = job.id;
		let cancelled = false;
		const timer = setInterval(async () => {
			try {
				const response = await fetch(`/admin/api/jobs/${id}`);
				if (!response.ok || cancelled) return;
				const next: JobStatus = (await response.json()).job;
				job = next;
				if (next.status !== 'running') {
					clearInterval(timer);
					await invalidate('admin:album');
					if (next.kind === 'import') rescan();
					feedback.toast(
						`${next.label} finished — ${next.done - next.failed} done${next.failed ? `, ${next.failed} failed` : ''}`,
						next.failed ? 'error' : 'success'
					);
				}
			} catch {
				// try again on the next tick
			}
		}, 1000);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	});

	const percent = $derived(job && job.total ? Math.round((job.done / job.total) * 100) : 0);
</script>

{#if job}
	<div class="job" class:finished={job.status !== 'running'} aria-live="polite">
		<div class="row">
			{#if running}<span class="spinner"></span>{/if}
			<strong>{job.label}</strong>
			<span class="subtle"
				>{job.done} / {job.total}{job.failed ? ` · ${job.failed} failed` : ''}</span
			>
			<span class="pct">{running ? `${percent}%` : 'Done'}</span>
		</div>
		<div class="bar"><span style:width="{running ? percent : 100}%"></span></div>
		{#if job.message && job.failed}<p class="error-text">Last error: {job.message}</p>{/if}
	</div>
{/if}

<div class="tasks">
	<div class="task">
		<RefreshCw size={18} strokeWidth={1.4} />
		<div>
			<h4>Regenerate thumbnails</h4>
			<p>Rebuild the thumbnail and medium-sized versions of every photo from the originals.</p>
		</div>
		<button
			class="btn btn-sm btn-quiet"
			disabled={running || !photoCount}
			onclick={() =>
				start(
					'regenerate',
					`This re-processes all ${photoCount} photos and may take a while for large albums.`
				)}
		>
			Regenerate
		</button>
	</div>

	<div class="task">
		<Camera size={18} strokeWidth={1.4} />
		<div>
			<h4>Re-extract metadata</h4>
			<p>Read dimensions, file size, capture date, camera, lens and exposure settings again.</p>
		</div>
		<button
			class="btn btn-sm btn-quiet"
			disabled={running || !photoCount}
			onclick={() => start('refresh-metadata')}
		>
			Re-extract
		</button>
	</div>

	<div class="task">
		<FolderInput size={18} strokeWidth={1.4} />
		<div>
			<h4>Import from server folder</h4>
			<p>
				Imports JPEG, PNG, WebP and GIF files from
				<code>{scan?.dir ?? '…'}</code>. Use a sub-folder named after this album's slug to keep
				imports separate. Imported files are moved out of the folder.
			</p>
			{#if scan}
				<p class="scan">
					{#if scan.files}
						<strong>{scan.files}</strong> image{scan.files === 1 ? '' : 's'} ready to import
						{#if scan.sample.length}<span class="subtle"
								>— {scan.sample.join(', ')}{scan.files > scan.sample.length ? ', …' : ''}</span
							>{/if}
					{:else}
						<span class="subtle">No images found in this folder.</span>
					{/if}
					<button class="link" onclick={rescan} disabled={scanning}
						>{scanning ? 'Scanning…' : 'Rescan'}</button
					>
				</p>
			{/if}
		</div>
		<button
			class="btn btn-sm btn-quiet"
			disabled={running || !scan?.files}
			onclick={() => start('import', `Import ${scan?.files} image(s) into this album?`)}
		>
			Import
		</button>
	</div>
</div>

<style>
	.job {
		display: grid;
		gap: 0.6rem;
		padding: 1rem 1.25rem;
		margin-bottom: 1.25rem;
		border: 1px solid var(--text);
		background: var(--bg-elevated);
	}

	.job.finished {
		border-color: var(--border);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.88rem;
	}

	.row strong {
		font-weight: 500;
	}

	.pct {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.bar {
		height: 3px;
		background: var(--surface-strong);
	}

	.bar span {
		display: block;
		height: 100%;
		background: var(--text);
		transition: width 0.4s var(--ease);
	}

	.tasks {
		display: grid;
		border: 1px solid var(--border);
		background: var(--bg-elevated);
	}

	.task {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: start;
		gap: 1rem;
		padding: 1.25rem;
		border-bottom: 1px solid var(--border);
	}

	.task:last-child {
		border-bottom: 0;
	}

	.task > :global(svg) {
		margin-top: 0.15rem;
		color: var(--text-muted);
	}

	h4 {
		font-family: var(--font-sans);
		font-size: 0.95rem;
		font-weight: 500;
	}

	.task p {
		margin-top: 0.3rem;
		font-size: 0.85rem;
		color: var(--text-muted);
	}

	code {
		font-size: 0.8rem;
		background: var(--surface);
		padding: 0.05rem 0.35rem;
		word-break: break-all;
	}

	.scan {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
	}

	.scan .link {
		font-size: 0.62rem;
	}

	@media (max-width: 640px) {
		.task {
			grid-template-columns: minmax(0, 1fr);
		}

		.task > :global(svg) {
			display: none;
		}
	}
</style>
