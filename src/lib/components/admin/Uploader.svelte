<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import type { AdminPhoto } from '#lib/types.js';

	interface Props {
		albumId: number;
		onuploaded: (photo: AdminPhoto) => void;
		ondone: (summary: { ok: number; failed: number }) => void;
	}

	let { albumId, onuploaded, ondone }: Props = $props();

	const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
	const ACCEPT_EXT = /\.(jpe?g|png|webp|gif)$/i;
	const CONCURRENCY = 3;

	let dragging = $state(false);
	let running = $state(false);
	let total = $state(0);
	let completed = $state(0);
	let failed = $state(0);
	let totalBytes = $state(0);
	let loadedBytes = $state(0);
	let errors = $state<string[]>([]);
	let skipped = $state(0);
	let input = $state<HTMLInputElement>();

	const percent = $derived(
		totalBytes ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0
	);

	function uploadOne(file: File, onBytes: (delta: number) => void): Promise<AdminPhoto> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			let sent = 0;
			xhr.open('POST', `/admin/api/albums/${albumId}/upload`);
			xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
			xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
			xhr.upload.onprogress = (event) => {
				onBytes(event.loaded - sent);
				sent = event.loaded;
			};
			xhr.onload = () => {
				onBytes(file.size - sent);
				if (xhr.status >= 200 && xhr.status < 300) {
					try {
						resolve(JSON.parse(xhr.responseText).photo);
					} catch {
						reject(new Error(`${file.name}: invalid server response`));
					}
				} else {
					let message = `${file.name}: upload failed (${xhr.status})`;
					try {
						message = JSON.parse(xhr.responseText).message ?? message;
					} catch {
						// keep default
					}
					reject(new Error(message));
				}
			};
			xhr.onerror = () => {
				onBytes(file.size - sent);
				reject(new Error(`${file.name}: network error`));
			};
			xhr.send(file);
		});
	}

	async function start(files: File[]) {
		if (running) return;
		const accepted = files.filter((f) => ACCEPT.includes(f.type) || ACCEPT_EXT.test(f.name));
		skipped = files.length - accepted.length;
		if (!accepted.length) {
			errors = skipped ? ['Only JPEG, PNG, WebP and GIF images can be uploaded.'] : [];
			return;
		}

		running = true;
		total = accepted.length;
		completed = 0;
		failed = 0;
		errors = [];
		totalBytes = accepted.reduce((sum, file) => sum + file.size, 0);
		loadedBytes = 0;

		// Large uploads are processed in small concurrent batches.
		const queue = accepted.slice();
		const worker = async () => {
			for (let file = queue.shift(); file; file = queue.shift()) {
				try {
					const photo = await uploadOne(file, (delta) => (loadedBytes += delta));
					onuploaded(photo);
				} catch (error) {
					failed++;
					errors = [...errors, (error as Error).message];
				}
				completed++;
			}
		};
		await Promise.all(Array.from({ length: Math.min(CONCURRENCY, accepted.length) }, worker));

		running = false;
		ondone({ ok: completed - failed, failed });
	}

	function ondrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		start([...(event.dataTransfer?.files ?? [])]);
	}
</script>

<div
	class="dropzone"
	class:dragging
	class:running
	role="region"
	aria-label="Upload photos"
	ondragover={(event) => {
		event.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	{ondrop}
>
	{#if running}
		<div class="progress-info" aria-live="polite">
			<div class="row">
				<span class="spinner"></span>
				<span>Uploading {Math.min(completed + 1, total)} of {total}</span>
				<strong>{percent}%</strong>
			</div>
			<div class="bar"><span style:width="{percent}%"></span></div>
			<p class="subtle">
				{completed - failed} uploaded{failed ? ` · ${failed} failed` : ''} — keep this page open until
				finished.
			</p>
		</div>
	{:else}
		<Upload size={22} strokeWidth={1.25} />
		<p>
			<strong>Drop photos here</strong> or
			<button type="button" class="browse" onclick={() => input?.click()}>browse files</button>
		</p>
		<p class="subtle">JPEG, PNG, WebP or GIF · multiple files supported</p>
		{#if total && !running}
			<p class="summary" aria-live="polite">
				Last upload: {completed - failed} succeeded{failed ? `, ${failed} failed` : ''}{skipped
					? `, ${skipped} skipped`
					: ''}.
			</p>
		{/if}
	{/if}
	<input
		bind:this={input}
		type="file"
		accept={ACCEPT.join(',')}
		multiple
		hidden
		onchange={(event) => {
			start([...(event.currentTarget.files ?? [])]);
			event.currentTarget.value = '';
		}}
	/>
</div>

{#if errors.length}
	<details class="errors">
		<summary>{errors.length} file{errors.length === 1 ? '' : 's'} could not be uploaded</summary>
		<ul>
			{#each errors as message, i (i)}<li>{message}</li>{/each}
		</ul>
	</details>
{/if}

<style>
	.dropzone {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		padding: 2rem 1.5rem;
		border: 1px dashed var(--border-strong);
		background: var(--bg-elevated);
		text-align: center;
		transition:
			border-color 0.2s,
			background-color 0.2s;
	}

	.dropzone.dragging {
		border-color: var(--text);
		background: var(--surface);
	}

	.dropzone.running {
		border-style: solid;
	}

	.browse {
		border: 0;
		background: none;
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.subtle {
		font-size: 0.8rem;
	}

	.summary {
		margin-top: 0.4rem;
		font-size: 0.82rem;
		color: var(--text-muted);
	}

	.progress-info {
		width: min(100%, 520px);
		display: grid;
		gap: 0.75rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9rem;
	}

	.row strong {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	.bar {
		height: 3px;
		background: var(--surface-strong);
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
		background: var(--text);
		transition: width 0.25s var(--ease);
	}

	.errors {
		margin-top: 0.75rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--danger);
		background: var(--danger-soft);
		color: var(--danger);
		font-size: 0.85rem;
	}

	.errors summary {
		cursor: pointer;
	}

	.errors ul {
		margin: 0.5rem 0 0;
		padding-left: 1.25rem;
	}
</style>
