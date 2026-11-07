<script lang="ts" module>
	export interface BarItem {
		key: string;
		label: string;
		value: number;
		note?: string;
		href?: string;
	}
</script>

<script lang="ts">
	interface Props {
		label: string;
		items: BarItem[];
		format: (value: number) => string;
		color?: string;
		empty?: string;
	}

	let {
		label,
		items,
		format,
		color = 'var(--viz-1)',
		empty = 'Nothing to show.'
	}: Props = $props();

	const max = $derived(Math.max(0, ...items.map((item) => item.value)));
	const total = $derived(items.reduce((sum, item) => sum + item.value, 0));
	let active = $state<string | null>(null);

	const share = (value: number) => (total ? Math.round((value / total) * 100) : 0);
</script>

<figure class="viz bars" aria-label={label}>
	{#if items.length && max > 0}
		<ul class="bar-list">
			{#each items as item (item.key)}
				<li
					class:dim={active !== null && active !== item.key}
					onpointerenter={() => (active = item.key)}
					onpointerleave={() => (active = null)}
				>
					<span class="bar-label">
						{#if item.href}<a href={item.href}>{item.label}</a>{:else}{item.label}{/if}
					</span>
					<span class="bar-track">
						<span
							class="bar"
							style:width="calc((100% - 7.5rem) * {Math.max(0.006, item.value / max)})"
							style:background={color}
						></span>
						<span class="bar-value">
							{format(item.value)}
							<span class="bar-share">{share(item.value)}%</span>
						</span>
					</span>
					{#if item.note}<span class="bar-note">{item.note}</span>{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">{empty}</p>
	{/if}
</figure>
