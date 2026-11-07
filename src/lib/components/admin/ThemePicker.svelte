<script lang="ts">
	import Link from '@lucide/svelte/icons/link-2';
	import ThemeIcon from './ThemeIcon.svelte';
	import type { ThemeSummary } from '#lib/types.js';

	interface Props {
		themes: ThemeSummary[];
		name: string;
		value?: string;
		/** Smaller cards, for pickers inside dense forms. */
		compact?: boolean;
		/**
		 * Adds a first choice with the value '' that follows another theme (like the site's), drawn in
		 * that theme's colours.
		 */
		inherit?: { label: string; theme: ThemeSummary | undefined };
		onchange?: (value: string) => void;
	}

	let { themes, name, value = $bindable(''), compact = false, inherit, onchange }: Props = $props();
</script>

{#snippet card(id: string, theme: ThemeSummary | undefined, title: string)}
	<label class="theme" class:checked={value === id} title={theme?.description}>
		<input type="radio" {name} value={id} bind:group={value} onchange={() => onchange?.(id)} />
		<span
			class="swatch"
			style:--s-bg={theme?.swatch.bg}
			style:--s-surface={theme?.swatch.surface}
			style:--s-text={theme?.swatch.text}
			style:--s-border={theme?.swatch.border}
			style:--s-accent={theme?.swatch.accent}
		>
			<span class="s-title"></span>
			<span class="s-panel"></span>
			<span class="s-bar"></span>
		</span>
		<span class="theme-label">
			{#if id}<ThemeIcon name={theme?.icon ?? ''} />{:else}<Link size={14} strokeWidth={1.5} />{/if}
			{title}
		</span>
	</label>
{/snippet}

<div class="themes" class:compact role="radiogroup">
	{#if inherit}
		{@render card('', inherit.theme, inherit.label)}
	{/if}
	{#each themes as theme (theme.id)}
		{@render card(theme.id, theme, theme.name)}
	{/each}
</div>

<style>
	.themes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr));
		gap: 1rem;
	}

	.themes.compact {
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 120px), 1fr));
		gap: 0.6rem;
	}

	.theme {
		position: relative;
		display: grid;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		cursor: pointer;
		transition: border-color 0.2s var(--ease);
	}

	.compact .theme {
		gap: 0.5rem;
		padding: 0.5rem;
	}

	.theme:hover {
		border-color: var(--border-strong);
	}

	.theme.checked {
		border-color: var(--text);
		outline: 1px solid var(--text);
	}

	.theme:has(input:focus-visible) {
		outline: 1px solid var(--highlight, var(--text));
		outline-offset: 3px;
	}

	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.swatch {
		--s-bg: var(--bg);
		--s-surface: var(--bg-elevated);
		--s-text: var(--text);
		--s-border: var(--border);
		--s-accent: var(--text);
		display: grid;
		grid-template-rows: 12px 1fr 8px;
		gap: 6px;
		height: 84px;
		padding: 10px;
		background: var(--s-bg);
		border: 1px solid color-mix(in srgb, var(--s-border) 60%, transparent);
	}

	.compact .swatch {
		height: 56px;
		padding: 8px;
		gap: 5px;
		grid-template-rows: 8px 1fr 6px;
	}

	.s-title {
		width: 60%;
		background: var(--s-text);
	}

	.s-panel {
		background: var(--s-surface);
		border: 1px solid var(--s-border);
	}

	.s-bar {
		width: 35%;
		background: var(--s-accent);
	}

	.theme-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.86rem;
	}

	.compact .theme-label {
		font-size: 0.8rem;
	}
</style>
