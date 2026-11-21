<script lang="ts">
	import { invalidate } from '$app/navigation';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import Copy from '@lucide/svelte/icons/copy';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import BackLink from '#lib/components/admin/BackLink.svelte';
	import { api, feedback } from '#lib/components/admin/feedback.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const subscribeUrl = $derived(data.feedUrl.replace(/^https?:/, 'webcal:'));
	let resetting = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(data.feedUrl);
			feedback.toast('Link copied');
		} catch {
			feedback.toast('Couldn’t copy the link. Select it and copy it by hand.', 'error');
		}
	}

	async function reset() {
		const ok = await feedback.confirm({
			title: 'Reset the calendar link?',
			message:
				'The current link stops working, and you’ll need to subscribe again with the new one.',
			confirmLabel: 'Reset Link',
			danger: true
		});
		if (!ok) return;
		resetting = true;
		try {
			await api('/admin/api/bookings/calendar', { action: 'reset' });
			await invalidate('admin:calendar');
			feedback.toast('Calendar link reset');
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			resetting = false;
		}
	}
</script>

<svelte:head>
	<title>Calendar — {data.settings.siteTitle}</title>
</svelte:head>

<BackLink list="jobs" label="Jobs" />

<header class="head">
	<p class="eyebrow">Jobs</p>
	<h1>Calendar Subscription</h1>
	<p class="muted intro">
		Subscribe once and your jobs appear in Apple Calendar, with new jobs and changes following on
		their own. Tentative jobs are marked as such, cancelled jobs drop off, and jobs without a date
		wait until they have one. Fees are never included.
	</p>
</header>

<section class="ui-card card">
	<div class="field">
		<label for="feed-url">Your private link</label>
		<input
			id="feed-url"
			class="input"
			readonly
			value={data.feedUrl}
			onfocus={(event) => event.currentTarget.select()}
		/>
		<p class="hint">
			Anyone with this link can see your jobs, including their notes, so keep it to yourself.
		</p>
	</div>
	<div class="ui-inline">
		<a class="btn btn-solid" href={subscribeUrl}>
			<CalendarPlus size={14} /> Add to Apple Calendar
		</a>
		<button class="btn btn-quiet" onclick={copy}><Copy size={14} /> Copy Link</button>
	</div>
	<p class="hint">
		On a Mac, the button opens Calendar. If it doesn’t, choose File → New Calendar Subscription and
		paste the link. In Calendar’s subscription settings, choose how often it refreshes and set the
		location to iCloud if you want your jobs on your iPhone too.
	</p>
</section>

<section class="ui-card card">
	<div class="ui-card-head">
		<h2>Reset the link</h2>
		<p class="hint">If the link has been shared by mistake, replace it with a new one.</p>
	</div>
	<div>
		<button class="btn btn-danger" onclick={reset} disabled={resetting}>
			{#if resetting}<span class="spinner"></span>{:else}<RotateCcw size={14} />{/if} Reset Link
		</button>
	</div>
</section>

<style>
	.head {
		margin: 1.5rem 0 2rem;
		max-width: 760px;
	}

	h1 {
		font-size: clamp(2.2rem, 4vw, 3rem);
		margin: 0.5rem 0 1rem;
	}

	.intro {
		line-height: 1.7;
	}

	.card {
		max-width: 760px;
	}

	.card + .card {
		margin-top: 1.5rem;
	}

	.btn {
		white-space: normal;
	}
</style>
