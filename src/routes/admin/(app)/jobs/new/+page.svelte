<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import BookingForm from '#lib/components/admin/BookingForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>New job — {data.settings.siteTitle}</title>
</svelte:head>

<div class="page">
	<a class="link" href="/admin/jobs"><ArrowLeft size={14} /> Jobs</a>
	<header>
		<p class="eyebrow">Jobs</p>
		<h1>New job</h1>
	</header>
	<BookingForm
		initial={data.initial}
		addresses={data.addresses}
		clients={data.clients}
		submitLabel="Create Job"
		error={form?.error ?? null}
		errorField={form?.field ?? null}
	/>
</div>

<style>
	.page {
		max-width: 760px;
	}

	header {
		margin: 1.5rem 0 2.5rem;
	}

	h1 {
		font-size: clamp(2.2rem, 4vw, 3rem);
		margin-top: 0.5rem;
	}
</style>
