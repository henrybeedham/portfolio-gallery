<!--
	Settings → Sign-in: adds and removes passkeys (passkeys.ts). It sits inside the settings form, so
	its buttons are type="button" and its input has no name.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { api, feedback } from './feedback.svelte.js';
	import { createPasskey, isCancelled, passkeysSupported } from '#lib/passkey-client.js';
	import { formatDateTime } from '#lib/utils.js';

	interface Passkey {
		id: string;
		name: string;
		createdAt: string;
		lastUsedAt: string | null;
	}

	let { passkeys }: { passkeys: Passkey[] } = $props();

	let supported = $state<boolean | null>(null);
	let name = $state('');
	let busy = $state(false);

	onMount(() => (supported = passkeysSupported()));

	async function add() {
		busy = true;
		try {
			const options = await api<Parameters<typeof createPasskey>[0]>('/admin/api/passkeys', {
				action: 'options'
			});
			const response = await createPasskey(options);
			const added = await api<Passkey>('/admin/api/passkeys', {
				action: 'register',
				response,
				name: name.trim() || 'Passkey'
			});
			name = '';
			await invalidate('admin:passkeys');
			feedback.toast(`Added “${added.name}”`);
		} catch (error) {
			if (isCancelled(error)) return;
			const message =
				error instanceof DOMException && error.name === 'InvalidStateError'
					? 'This device already has a passkey for the site.'
					: (error as Error).message;
			feedback.toast(message, 'error');
		} finally {
			busy = false;
		}
	}

	async function remove(passkey: Passkey) {
		const ok = await feedback.confirm({
			title: `Remove “${passkey.name}”?`,
			message:
				'It can no longer sign in here. Delete it from the device’s password manager too, or it will keep being offered.',
			confirmLabel: 'Remove Passkey',
			danger: true
		});
		if (!ok) return;
		try {
			await api('/admin/api/passkeys', { action: 'delete', id: passkey.id });
			await invalidate('admin:passkeys');
			feedback.toast(`Removed “${passkey.name}”`);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		}
	}
</script>

<div class="passkeys">
	{#if supported === false}
		<p class="hint">
			This browser can’t add passkeys here. Passkeys need a secure (https) address and a recent
			browser.
		</p>
	{:else if supported}
		<div class="add">
			<div class="field">
				<label for="passkey-name">Name <span class="ui-optional">optional</span></label>
				<input
					id="passkey-name"
					class="input"
					bind:value={name}
					maxlength="60"
					placeholder="e.g. iPhone or MacBook"
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							add();
						}
					}}
				/>
			</div>
			<button type="button" class="btn btn-sm btn-solid" onclick={add} disabled={busy}>
				{#if busy}<span class="spinner"></span>{:else}<KeyRound size={14} strokeWidth={1.5} />{/if}
				Add Passkey
			</button>
		</div>
	{/if}

	{#if passkeys.length}
		<div class="ui-table-wrap list">
			<table class="ui-table">
				<thead>
					<tr>
						<th>Passkey</th>
						<th>Added</th>
						<th>Last used</th>
						<th class="ui-shrink"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each passkeys as passkey (passkey.id)}
						<tr>
							<td>{passkey.name}</td>
							<td class="when">{formatDateTime(passkey.createdAt)}</td>
							<td class="when">
								{passkey.lastUsedAt ? formatDateTime(passkey.lastUsedAt) : 'Never'}
							</td>
							<td class="ui-shrink">
								<button
									type="button"
									class="ui-icon-btn danger"
									onclick={() => remove(passkey)}
									title="Remove"
									aria-label="Remove {passkey.name}"
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
</div>

<style>
	.passkeys {
		display: grid;
		gap: 1rem;
	}

	.add {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.75rem;
	}

	.add .field {
		flex: 1 1 14rem;
	}

	.add .btn {
		min-height: 44px;
	}

	.list {
		border: 1px solid var(--border);
	}

	.when {
		white-space: nowrap;
		color: var(--text-muted);
		font-size: 0.82rem;
	}
</style>
