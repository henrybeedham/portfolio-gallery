<script lang="ts">
	import { invalidate } from '$app/navigation';
	import Download from '@lucide/svelte/icons/download';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { formatDateTime } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let name = $state('Lightroom');
	let creating = $state(false);
	/** The token just made: shown once, then gone for good. */
	let fresh = $state<string | null>(null);

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
			const result = await api<{ token: string }>('/admin/api/lightroom', {
				action: 'create-token',
				name
			});
			fresh = result.token;
			await invalidate('admin:lightroom');
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
				'Anything using this token, such as Lightroom, stops being able to publish until you give it a new one.',
			confirmLabel: 'Revoke Token',
			danger: true
		});
		if (!ok) return;
		try {
			await api('/admin/api/lightroom', { action: 'revoke-token', id: token.id });
			await invalidate('admin:lightroom');
			feedback.toast(`Revoked “${token.name}”`);
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		}
	}
</script>

<svelte:head>
	<title>Lightroom — {data.settings.siteTitle}</title>
</svelte:head>

<header class="head">
	<p class="eyebrow">Apps</p>
	<h1>Lightroom Classic</h1>
	<p class="muted intro">
		Publish straight from Lightroom. Each collection in the Gallery publish service becomes an album
		here, and edits you make later go up with one click on Publish.
	</p>
</header>

<div class="steps">
	<section class="ui-card">
		<div class="ui-card-head">
			<p class="eyebrow">Step 1</p>
			<h2>Install the plugin</h2>
		</div>
		<div>
			<a class="btn btn-solid" href="/admin/lightroom/plugin.zip" download>
				<Download size={14} /> Download Plugin
			</a>
		</div>
		<ol class="how">
			<li>
				Unzip it and move <code>GalleryPublisher.lrplugin</code> somewhere it can stay, such as your Documents
				folder. Lightroom loads it from there each time.
			</li>
			<li>In Lightroom Classic, choose File → Plug-in Manager, click Add and choose the folder.</li>
		</ol>
		<p class="hint">
			This site’s address is already filled in. It works with Lightroom Classic 6 and later.
		</p>
	</section>

	<section class="ui-card">
		<div class="ui-card-head">
			<p class="eyebrow">Step 2</p>
			<h2>Make a token</h2>
			<p class="hint">
				A token lets Lightroom publish without your password. It can do anything you can, so make
				one for each computer and revoke any you stop using.
			</p>
		</div>

		{#if fresh}
			<div class="fresh">
				<label for="token">Your new token</label>
				<div class="copy-row">
					<input
						id="token"
						class="input mono"
						readonly
						value={fresh}
						onfocus={(event) => event.currentTarget.select()}
					/>
					<button class="btn btn-solid" onclick={() => copy(fresh!, 'Token')}>
						<Copy size={14} /> Copy
					</button>
				</div>
				<p class="hint">
					Paste it into Lightroom now. It won’t be shown again; if you lose it, make another.
				</p>
			</div>
		{/if}

		<form class="copy-row" onsubmit={create}>
			<input
				class="input"
				bind:value={name}
				aria-label="Token name"
				placeholder="Lightroom on the MacBook"
				maxlength="100"
			/>
			<button class="btn btn-quiet" disabled={creating}>
				{#if creating}<span class="spinner"></span>{:else}<KeyRound size={14} />{/if} Make Token
			</button>
		</form>

		{#if data.tokens.length}
			<div class="ui-table-wrap tokens">
				<table class="ui-table">
					<thead>
						<tr>
							<th>Name</th>
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
	</section>

	<section class="ui-card">
		<div class="ui-card-head">
			<p class="eyebrow">Step 3</p>
			<h2>Set up the publish service</h2>
		</div>
		<ol class="how">
			<li>In the Library’s Publish Services panel, click Set Up next to Gallery.</li>
			<li>
				Check the site address, paste your token and click Test Connection. Choose the JPEG quality
				and size you want clients to download, then Save.
			</li>
			<li>
				Right-click Gallery and choose Create Album. Pick a job to link it to, or an album that’s
				already here. Drag photos in and click Publish.
			</li>
		</ol>
		<div class="field">
			<label for="address">Site address</label>
			<div class="copy-row">
				<input
					id="address"
					class="input"
					readonly
					value={data.origin}
					onfocus={(event) => event.currentTarget.select()}
				/>
				<button class="btn btn-quiet" onclick={() => copy(data.origin, 'Address')}>
					<Copy size={14} /> Copy
				</button>
			</div>
		</div>
	</section>

	<section class="ui-card">
		<div class="ui-card-head">
			<h2>How it behaves</h2>
		</div>
		<ul class="how">
			<li>
				Republishing an edited photo replaces it in place, keeping its link, tags and download
				count.
			</li>
			<li>Removing a photo from the collection deletes it from the album.</li>
			<li>Renaming the collection renames the album. Its web address stays the same.</li>
			<li>
				Deleting the collection leaves the album here. Delete it from Galleries if you mean to.
			</li>
			<li>Keywords become the album’s tags, as with any upload.</li>
			<li>A linked job is marked delivered once its album is public and has photos in it.</li>
		</ul>
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

	.intro {
		line-height: 1.7;
	}

	.steps {
		display: grid;
		gap: 1.5rem;
		max-width: 760px;
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
	.mono {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.86em;
	}

	.copy-row {
		display: flex;
		gap: 0.5rem;
	}

	.copy-row .input {
		flex: 1;
		min-width: 0;
	}

	.fresh {
		display: grid;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--success) 50%, transparent);
		background: var(--success-soft);
	}

	.fresh label {
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

	@media (max-width: 520px) {
		.copy-row {
			flex-wrap: wrap;
		}
	}
</style>
