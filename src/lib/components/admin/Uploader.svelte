<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import type { AdminPhoto } from '#lib/types.js';

	interface Props {
		albumId: number;
		/** The section new uploads go into, if any. */
		sectionId?: number | null;
		onuploaded: (photo: AdminPhoto) => void;
		ondone: (summary: { ok: number; failed: number; skipped: number }) => void;
		/** Show the large drop area while idle (an empty album). Otherwise only progress shows. */
		dropzone?: boolean;
	}

	let { albumId, sectionId = null, onuploaded, ondone, dropzone = false }: Props = $props();

	const ACCEPT = [
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/gif',
		'video/mp4',
		'video/quicktime',
		'video/webm'
	];
	const ACCEPT_EXT = /\.(jpe?g|png|webp|gif|mp4|m4v|mov|webm)$/i;
	const CONCURRENCY = 3;
	/**
	 * Files go up in pieces this size, so each request stays well inside a proxy's time limit (60 s
	 * on Traefik) and a dropped connection only costs one piece.
	 */
	const CHUNK = 8 * 1024 * 1024;
	const RETRIES = 4;

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

	type Reply = { photo?: AdminPhoto; received?: number };

	function uploadId() {
		// crypto.randomUUID needs HTTPS; this works over plain HTTP on a LAN too.
		return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
			byte.toString(16).padStart(2, '0')
		).join('');
	}

	/** Sends one piece. Resolves with the server's reply, including 409's “carry on from here”. */
	function sendPiece(
		file: File,
		id: string,
		offset: number,
		section: number | null,
		onBytes: (delta: number) => void
	): Promise<Reply> {
		const piece = file.slice(offset, Math.min(file.size, offset + CHUNK));
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			let sent = 0;
			xhr.open('POST', `/admin/api/albums/${albumId}/upload`);
			xhr.setRequestHeader('content-type', 'application/octet-stream');
			xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
			xhr.setRequestHeader('x-upload-id', id);
			xhr.setRequestHeader('x-upload-offset', String(offset));
			xhr.setRequestHeader('x-upload-size', String(file.size));
			if (section !== null) xhr.setRequestHeader('x-section-id', String(section));
			xhr.upload.onprogress = (event) => {
				onBytes(event.loaded - sent);
				sent = event.loaded;
			};
			xhr.onload = () => {
				let reply: Reply & { message?: string } = {};
				try {
					reply = JSON.parse(xhr.responseText);
				} catch {
					// not JSON
				}
				if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 409) {
					// Count only what the server kept.
					onBytes((reply.photo ? piece.size : (reply.received ?? offset) - offset) - sent);
					resolve(reply);
				} else {
					onBytes(-sent);
					const error = new Error(reply.message ?? `${file.name}: upload failed (${xhr.status})`);
					// Proxies and restarts answer 502–504; those are worth another try.
					reject(Object.assign(error, { retry: xhr.status >= 500 }));
				}
			};
			xhr.onerror = () => {
				onBytes(-sent);
				reject(Object.assign(new Error(`${file.name}: network error`), { retry: true }));
			};
			xhr.send(piece);
		});
	}

	async function uploadOne(
		file: File,
		section: number | null,
		onBytes: (delta: number) => void
	): Promise<AdminPhoto> {
		const id = uploadId();
		let offset = 0;
		let failures = 0;
		for (;;) {
			try {
				const reply = await sendPiece(file, id, offset, section, onBytes);
				if (reply.photo) return reply.photo;
				offset = reply.received ?? offset;
				failures = 0;
			} catch (error) {
				if (!(error as { retry?: boolean }).retry || ++failures > RETRIES) throw error;
				// Wait a little longer each time, then ask the server where to carry on from.
				await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** failures));
			}
		}
	}

	/** Opens the file picker. */
	export function browse() {
		input?.click();
	}

	export async function start(files: File[]) {
		if (running) return;
		const accepted = files.filter((f) => ACCEPT.includes(f.type) || ACCEPT_EXT.test(f.name));
		skipped = files.length - accepted.length;
		if (!accepted.length) {
			errors = skipped
				? ['Only JPEG, PNG, WebP and GIF photos, and MP4, MOV and WebM videos, can be uploaded.']
				: [];
			return;
		}

		running = true;
		total = accepted.length;
		completed = 0;
		failed = 0;
		errors = [];
		totalBytes = accepted.reduce((sum, file) => sum + file.size, 0);
		loadedBytes = 0;

		// Changing the section mid-way doesn't move files that are already on their way.
		const section = sectionId;
		// Large uploads are processed in small concurrent batches.
		const queue = accepted.slice();
		const worker = async () => {
			for (let file = queue.shift(); file; file = queue.shift()) {
				try {
					const photo = await uploadOne(file, section, (delta) => (loadedBytes += delta));
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
		ondone({ ok: completed - failed, failed, skipped });
	}

	function ondrop(event: DragEvent) {
		event.preventDefault();
		dragging = false;
		start([...(event.dataTransfer?.files ?? [])]);
	}
</script>

{#if running}
	<div class="progress" aria-live="polite">
		<div class="row">
			<span class="spinner"></span>
			<span>Uploading {Math.min(completed + 1, total)} of {total}</span>
			<span class="subtle">
				{completed - failed} done{failed ? ` · ${failed} failed` : ''} · keep this page open
			</span>
			<strong>{percent}%</strong>
		</div>
		<div class="bar"><span style:width="{percent}%"></span></div>
	</div>
{:else if dropzone}
	<div
		class="dropzone"
		class:dragging
		role="region"
		aria-label="Upload photos and videos"
		ondragover={(event) => {
			event.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		{ondrop}
	>
		<Upload size={22} strokeWidth={1.25} />
		<p>
			<strong>Drop photos or videos here</strong> or
			<button type="button" class="browse" onclick={browse}>browse files</button>
		</p>
		<p class="subtle">JPEG, PNG, WebP, GIF, MP4, MOV or WebM · multiple files supported</p>
	</div>
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

{#if errors.length}
	<details class="errors">
		<summary>{errors.length} file{errors.length === 1 ? '' : 's'} could not be uploaded</summary>
		<ul>
			{#each errors as message, i (i)}<li>{message}</li>{/each}
		</ul>
	</details>
{/if}

<style>
	.dropzone,
	.progress {
		margin-bottom: 1.25rem;
	}

	.dropzone {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		padding: 3.5rem 1.5rem;
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

	.progress {
		display: grid;
		gap: 0.65rem;
		padding: 0.9rem 1.1rem;
		border: 1px solid var(--border);
		background: var(--bg-elevated);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.75rem;
		font-size: 0.88rem;
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
		margin-bottom: 1.25rem;
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
