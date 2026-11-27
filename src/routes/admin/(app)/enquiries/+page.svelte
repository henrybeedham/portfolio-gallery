<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Archive from '@lucide/svelte/icons/archive';
	import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Mail from '@lucide/svelte/icons/mail';
	import MailCheck from '@lucide/svelte/icons/mail-check';
	import MailOpen from '@lucide/svelte/icons/mail-open';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import { formatDateTime, formatDay } from '#lib/utils.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let busy = $state<string | null>(null);

	type Enquiry = (typeof data.enquiries)[number];

	const archived = $derived(page.url.searchParams.get('show') === 'archived');
	const shown = $derived(data.enquiries.filter((enquiry) => enquiry.archived === archived));
	const inboxCount = $derived(data.enquiries.filter((enquiry) => !enquiry.archived).length);
	const archivedCount = $derived(data.enquiries.length - inboxCount);

	async function send(enquiry: Enquiry, action: string, value?: boolean) {
		busy = `${action}:${enquiry.id}`;
		try {
			const result = await api<{ bookingId?: number }>('/admin/api/enquiries', {
				action,
				id: enquiry.id,
				value
			});
			await invalidate('admin:enquiries');
			return result;
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			busy = null;
		}
	}

	async function makeJob(enquiry: Enquiry) {
		const result = await send(enquiry, 'make-job');
		if (result?.bookingId) await goto(`/admin/jobs/${result.bookingId}`);
	}

	async function archive(enquiry: Enquiry, value: boolean) {
		if (await send(enquiry, 'set-archived', value)) {
			feedback.toast(value ? 'Enquiry archived' : 'Enquiry moved to the inbox');
		}
	}

	async function remove(enquiry: Enquiry) {
		const ok = await feedback.confirm({
			title: `Delete the enquiry from ${enquiry.name}?`,
			message: 'It’s deleted for good. A job made from it is kept.',
			confirmLabel: 'Delete Enquiry',
			danger: true
		});
		if (ok && (await send(enquiry, 'delete'))) feedback.toast('Enquiry deleted');
	}

	function replyHref(enquiry: Enquiry) {
		const subject = `Re: your enquiry${enquiry.eventDate ? ` for ${formatDay(enquiry.eventDate)}` : ''}`;
		return `mailto:${enquiry.email}?subject=${encodeURIComponent(subject)}`;
	}
</script>

<svelte:head>
	<title>Enquiries — {data.settings.siteTitle}</title>
</svelte:head>

<header class="ui-head">
	<div>
		<p class="eyebrow">From the homepage</p>
		<h1>Enquiries</h1>
	</div>
</header>

{#if !data.formOn}
	<p class="intro muted">
		The enquiry form is turned off. Turn it on under
		<a class="link" href="/admin/settings#contact">Settings → Contact</a> to show it in the homepage’s
		About section.
	</p>
{/if}

<nav class="ui-chips" aria-label="Filter enquiries">
	<a class="ui-chip" class:active={!archived} href="/admin/enquiries" data-sveltekit-noscroll>
		Inbox <span class="count">{inboxCount}</span>
	</a>
	<a
		class="ui-chip"
		class:active={archived}
		href="/admin/enquiries?show=archived"
		data-sveltekit-noscroll
	>
		Archived <span class="count">{archivedCount}</span>
	</a>
</nav>

{#if shown.length}
	<ol class="list">
		{#each shown as enquiry (enquiry.id)}
			<li class="ui-panel enquiry" class:unread={!enquiry.read} id="enquiry-{enquiry.id}">
				<div class="top">
					<div class="who">
						<h2>{enquiry.name}</h2>
						<p class="ui-sub">
							{formatDateTime(enquiry.createdAt)}
							{#if !enquiry.read}<span class="ui-badge new">New</span>{/if}
						</p>
					</div>
					<div class="ui-row-actions">
						<button
							class="ui-icon-btn"
							onclick={() => send(enquiry, 'set-read', !enquiry.read)}
							disabled={!!busy}
							title={enquiry.read ? 'Mark as unread' : 'Mark as read'}
							aria-label={enquiry.read ? 'Mark as unread' : 'Mark as read'}
						>
							{#if enquiry.read}<Mail size={15} strokeWidth={1.5} />{:else}<MailOpen
									size={15}
									strokeWidth={1.5}
								/>{/if}
						</button>
						<button
							class="ui-icon-btn"
							onclick={() => archive(enquiry, !enquiry.archived)}
							disabled={!!busy}
							title={enquiry.archived ? 'Move to inbox' : 'Archive'}
							aria-label={enquiry.archived ? 'Move to inbox' : 'Archive'}
						>
							{#if enquiry.archived}<ArchiveRestore size={15} strokeWidth={1.5} />{:else}<Archive
									size={15}
									strokeWidth={1.5}
								/>{/if}
						</button>
						<button
							class="ui-icon-btn danger"
							onclick={() => remove(enquiry)}
							disabled={!!busy}
							title="Delete"
							aria-label="Delete the enquiry from {enquiry.name}"
						>
							<Trash2 size={15} strokeWidth={1.5} />
						</button>
					</div>
				</div>

				<dl class="details">
					<div>
						<dt>Email</dt>
						<dd><a class="link" href="mailto:{enquiry.email}">{enquiry.email}</a></dd>
					</div>
					{#if enquiry.phone}
						<div>
							<dt>Phone</dt>
							<dd>
								<a class="link" href="tel:{enquiry.phone.replace(/[^\d+]/g, '')}">
									{enquiry.phone}
								</a>
							</dd>
						</div>
					{/if}
					{#if enquiry.eventDate}
						<div>
							<dt>Date</dt>
							<dd>{formatDay(enquiry.eventDate)}</dd>
						</div>
					{/if}
					{#if enquiry.location}
						<div>
							<dt>Location</dt>
							<dd>{enquiry.location}</dd>
						</div>
					{/if}
				</dl>

				<p class="message">{enquiry.message}</p>

				<div class="actions">
					<a
						class="btn btn-sm"
						href={replyHref(enquiry)}
						onclick={() => {
							if (!enquiry.read) send(enquiry, 'set-read', true);
						}}
					>
						<MailCheck size={14} /> Reply by Email
					</a>
					{#if enquiry.bookingId}
						<a class="btn btn-sm btn-quiet" href="/admin/jobs/{enquiry.bookingId}">
							<Briefcase size={14} /> View Job
						</a>
					{:else}
						<button class="btn btn-sm btn-solid" onclick={() => makeJob(enquiry)} disabled={!!busy}>
							{#if busy === `make-job:${enquiry.id}`}<span class="spinner"></span>{:else}<Briefcase
									size={14}
								/>{/if}
							Make Job
						</button>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
{:else}
	<div class="ui-empty">
		<Inbox size={28} strokeWidth={1} />
		<p>{archived ? 'No archived enquiries.' : 'No enquiries yet.'}</p>
	</div>
{/if}

<style>
	.intro {
		max-width: 62ch;
		margin-bottom: 1.5rem;
		line-height: 1.6;
	}

	.ui-chips {
		margin-bottom: 1.5rem;
	}

	.count {
		color: var(--text-subtle);
		margin-left: 0.35rem;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1rem;
	}

	.enquiry {
		display: grid;
		gap: 1.1rem;
		padding: clamp(1rem, 3vw, 1.5rem);
		scroll-margin-top: 1.5rem;
	}

	.enquiry.unread {
		border-left: 2px solid var(--highlight, var(--text));
	}

	.top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.who {
		display: grid;
		gap: 0.3rem;
		min-width: 0;
	}

	h2 {
		font-size: 1.5rem;
		overflow-wrap: anywhere;
	}

	.new {
		margin-left: 0.5rem;
	}

	.details {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
		gap: 0.9rem 1.5rem;
		margin: 0;
	}

	dt {
		font-size: 0.68rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 0.2rem;
	}

	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.message {
		white-space: pre-line;
		line-height: 1.65;
		max-width: 70ch;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}
</style>
