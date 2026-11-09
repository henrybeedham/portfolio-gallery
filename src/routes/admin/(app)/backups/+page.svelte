<script lang="ts">
	import { invalidate, invalidateAll } from '$app/navigation';
	import DatabaseBackup from '@lucide/svelte/icons/database-backup';
	import Download from '@lucide/svelte/icons/download';
	import HardDriveDownload from '@lucide/svelte/icons/hard-drive-download';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { formatBytes, formatDateTime } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let busy = $state<string | null>(null);

	type Backup = (typeof data.backups)[number];

	const REASONS: Record<Backup['reason'], string> = {
		update: 'Before an update',
		manual: 'Made by hand',
		restore: 'Before a restore'
	};

	async function send(action: string, name: string | null, message: string) {
		busy = name ?? action;
		try {
			await api('/admin/api/backups', { action, name });
			// A restore changes everything, settings included.
			if (action === 'restore') await invalidateAll();
			else await invalidate('admin:backups');
			feedback.toast(message);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			busy = null;
		}
	}

	async function restore(backup: Backup) {
		const ok = await feedback.confirm({
			title: `Restore the backup from ${formatDateTime(backup.createdAt)}?`,
			message:
				'Albums, jobs, invoices, settings and analytics go back to how they were then. Photos and videos added since stay on disk but drop out of their albums. What’s there now is backed up first.',
			confirmLabel: 'Restore Backup',
			danger: true
		});
		if (ok) await send('restore', backup.name, 'Backup restored');
	}

	async function remove(backup: Backup) {
		const ok = await feedback.confirm({
			title: 'Delete this backup?',
			message: `The backup from ${formatDateTime(backup.createdAt)} is deleted for good.`,
			confirmLabel: 'Delete Backup',
			danger: true
		});
		if (ok) await send('delete', backup.name, 'Backup deleted');
	}
</script>

<svelte:head>
	<title>Backups — {data.settings.siteTitle}</title>
</svelte:head>

<header class="ui-head">
	<div>
		<p class="eyebrow">Maintenance</p>
		<h1>Backups</h1>
	</div>
	<div class="ui-actions">
		<a class="btn btn-quiet" href="/admin/api/backups/everything" download>
			<HardDriveDownload size={14} /> Download Everything
		</a>
		<button
			class="btn btn-solid"
			onclick={() => send('create', null, 'Backup saved')}
			disabled={!!busy}
		>
			{#if busy === 'create'}<span class="spinner"></span>{:else}<DatabaseBackup size={14} />{/if}
			Back Up Now
		</button>
	</div>
</header>

<div class="intro muted">
	<p>
		The database (albums, jobs, invoices, settings and analytics) is backed up here automatically
		before every update, and the last ten of those are kept. Photos and videos aren’t in these
		backups.
	</p>
	<p>
		These backups sit on the same disk as everything else. Now and then, use Download Everything for
		a full copy to keep somewhere else: the database plus {formatBytes(data.originalBytes)} of original
		photos and videos.
	</p>
</div>

<section class="ui-panel">
	{#if data.backups.length}
		<div class="ui-table-wrap">
			<table class="ui-table">
				<thead>
					<tr>
						<th>Saved</th>
						<th>Kind</th>
						<th class="ui-num">Size</th>
						<th class="ui-shrink"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.backups as backup (backup.name)}
						<tr>
							<td class="nowrap">{formatDateTime(backup.createdAt)}</td>
							<td>{REASONS[backup.reason]}</td>
							<td class="ui-num">{formatBytes(backup.size)}</td>
							<td class="ui-shrink">
								<div class="ui-row-actions">
									<a
										class="ui-icon-btn"
										href="/admin/api/backups/{backup.name}"
										download
										title="Download"
										aria-label="Download the backup from {formatDateTime(backup.createdAt)}"
									>
										<Download size={15} strokeWidth={1.5} />
									</a>
									<button
										class="ui-icon-btn"
										onclick={() => restore(backup)}
										disabled={!!busy}
										title="Restore"
										aria-label="Restore the backup from {formatDateTime(backup.createdAt)}"
									>
										{#if busy === backup.name}<span class="spinner"></span>{:else}<RotateCcw
												size={15}
												strokeWidth={1.5}
											/>{/if}
									</button>
									<button
										class="ui-icon-btn danger"
										onclick={() => remove(backup)}
										disabled={!!busy}
										title="Delete"
										aria-label="Delete the backup from {formatDateTime(backup.createdAt)}"
									>
										<Trash2 size={15} strokeWidth={1.5} />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="ui-empty">
			<DatabaseBackup size={28} strokeWidth={1} />
			<h3>No backups yet</h3>
			<p>One is made automatically before the next update, or you can make one now.</p>
		</div>
	{/if}
</section>

<style>
	.intro {
		display: grid;
		gap: 0.75rem;
		max-width: 68ch;
		margin-bottom: 2rem;
		line-height: 1.7;
	}

	.nowrap {
		white-space: nowrap;
	}
</style>
