<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import AlbumForm from '#lib/components/admin/AlbumForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>New album — {data.settings.siteTitle}</title>
</svelte:head>

<div class="page">
	<a class="link" href="/admin"><ArrowLeft size={14} /> Dashboard</a>
	<header>
		<p class="eyebrow">Albums</p>
		<h1>New album</h1>
		<p class="muted">
			Set up the album, then upload photos on the next screen.
			{#if data.job}It will be linked to <a href="/admin/jobs/{data.job.id}">{data.job.title}</a
				>.{/if}
		</p>
	</header>

	<AlbumForm
		mode="create"
		initial={data.defaults}
		themes={data.themes}
		siteTheme={data.siteTheme}
		origin={data.origin}
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
		margin: 0.5rem 0 0.75rem;
	}

	header a {
		color: var(--text);
		text-underline-offset: 3px;
	}
</style>
