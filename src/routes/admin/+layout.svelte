<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// The Home Screen label, matching the manifest's short_name (it's editable when adding).
	const shortName = $derived(
		data.settings.siteTitle.length > 14 ? 'Gallery' : data.settings.siteTitle
	);
</script>

<!-- Lets the admin area be added to a phone's Home Screen and opened like an app. -->
<svelte:head>
	<link rel="manifest" href="/site/manifest.webmanifest" />
	<meta name="apple-mobile-web-app-title" content={shortName} />
	<meta name="mobile-web-app-capable" content="yes" />
</svelte:head>

{@render children()}
