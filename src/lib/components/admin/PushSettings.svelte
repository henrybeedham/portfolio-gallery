<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import Bell from '@lucide/svelte/icons/bell';
	import BellOff from '@lucide/svelte/icons/bell-off';
	import Share from '@lucide/svelte/icons/share';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { api, feedback } from './feedback.svelte.js';
	import {
		currentSubscription,
		pushSupport,
		subscribe,
		type PushSupport
	} from '#lib/push-client.js';
	import { formatDateTime } from '#lib/utils.js';

	interface Device {
		id: number;
		name: string;
		endpoint: string;
		createdAt: string;
	}

	let { publicKey, devices }: { publicKey: string; devices: Device[] } = $props();

	let support = $state<PushSupport | null>(null);
	/** This browser's subscription endpoint, if it has one. */
	let endpoint = $state<string | null>(null);
	let busy = $state(false);

	const thisDevice = $derived(devices.find((d) => d.endpoint === endpoint));

	onMount(async () => {
		support = pushSupport();
		if (support !== 'supported') return;
		try {
			const subscription = await currentSubscription();
			endpoint = subscription?.endpoint ?? null;
			// Subscribed here but forgotten by the server (removed from another device): re-save it.
			if (subscription && Notification.permission === 'granted' && !thisDevice) {
				await api('/admin/api/push', { action: 'subscribe', subscription: subscription.toJSON() });
				await invalidate('admin:push');
			}
		} catch {
			// The service worker couldn't register (for example over plain http); leave it off.
		}
	});

	async function enable() {
		busy = true;
		try {
			const subscription = await subscribe(publicKey);
			await api('/admin/api/push', { action: 'subscribe', subscription: subscription.toJSON() });
			endpoint = subscription.endpoint;
			await invalidate('admin:push');
			feedback.toast('Notifications are on for this device');
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		try {
			const subscription = await currentSubscription();
			await subscription?.unsubscribe();
			if (endpoint) await api('/admin/api/push', { action: 'unsubscribe', endpoint });
			endpoint = null;
			await invalidate('admin:push');
			feedback.toast('Notifications are off for this device');
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			busy = false;
		}
	}

	async function test() {
		busy = true;
		try {
			const { sent } = await api<{ sent: number }>('/admin/api/push', { action: 'test' });
			if (sent) feedback.toast(`Test sent to ${sent === 1 ? 'one device' : `${sent} devices`}`);
			else
				feedback.toast('No device accepted the test. Try turning notifications on again.', 'error');
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			busy = false;
		}
	}

	async function remove(device: Device) {
		const ok = await feedback.confirm({
			title: `Stop notifying “${device.name}”?`,
			message: 'It won’t get notifications until they’re turned on again from that device.',
			confirmLabel: 'Remove Device',
			danger: true
		});
		if (!ok) return;
		try {
			if (device.endpoint === endpoint) {
				await (await currentSubscription())?.unsubscribe();
				endpoint = null;
			}
			await api('/admin/api/push', { action: 'unsubscribe', id: device.id });
			await invalidate('admin:push');
			feedback.toast(`Removed “${device.name}”`);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		}
	}
</script>

<div class="push">
	{#if support === 'needs-install'}
		<div class="install">
			<p>On an iPhone or iPad, notifications only work from the Home Screen app.</p>
			<ol>
				<li>
					Tap <Share size={14} strokeWidth={1.5} aria-label="Share" /> Share in Safari, then
					<strong>Add to Home Screen</strong>.
				</li>
				<li>Open the site from its new Home Screen icon and sign in.</li>
				<li>Come back to Settings and turn notifications on.</li>
			</ol>
		</div>
	{:else if support === 'unsupported'}
		<p class="hint">This browser can’t receive push notifications.</p>
	{:else if support === 'supported'}
		<div class="actions">
			{#if thisDevice}
				<button type="button" class="btn btn-sm btn-quiet" onclick={disable} disabled={busy}>
					<BellOff size={14} strokeWidth={1.5} /> Turn Off on This Device
				</button>
			{:else}
				<button type="button" class="btn btn-sm btn-solid" onclick={enable} disabled={busy}>
					<Bell size={14} strokeWidth={1.5} /> Turn On for This Device
				</button>
			{/if}
			{#if devices.length}
				<button type="button" class="btn btn-sm btn-quiet" onclick={test} disabled={busy}>
					Send Test
				</button>
			{/if}
		</div>
	{/if}

	{#if devices.length}
		<div class="ui-table-wrap devices">
			<table class="ui-table">
				<thead>
					<tr>
						<th>Device</th>
						<th>Added</th>
						<th class="ui-shrink"><span class="visually-hidden">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each devices as device (device.id)}
						<tr>
							<td>
								{device.name}
								{#if device.endpoint === endpoint}<span class="this">This device</span>{/if}
							</td>
							<td class="when">{formatDateTime(device.createdAt)}</td>
							<td class="ui-shrink">
								<button
									type="button"
									class="ui-icon-btn danger"
									onclick={() => remove(device)}
									title="Remove"
									aria-label="Remove {device.name}"
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
	.push {
		display: grid;
		gap: 1rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.install {
		display: grid;
		gap: 0.6rem;
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		background: var(--surface);
		font-size: 0.88rem;
	}

	.install p {
		margin: 0;
	}

	.install ol {
		margin: 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.35rem;
		color: var(--text-muted);
	}

	.install :global(svg) {
		vertical-align: -2px;
	}

	.devices {
		border: 1px solid var(--border);
	}

	.this {
		margin-left: 0.5rem;
		font-size: 0.62rem;
		letter-spacing: 0.15em;
		text-transform: uppercase;
		color: var(--highlight, var(--text));
	}

	.when {
		white-space: nowrap;
		color: var(--text-muted);
		font-size: 0.82rem;
	}
</style>
