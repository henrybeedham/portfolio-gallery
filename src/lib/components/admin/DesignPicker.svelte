<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { DESIGNS, type DesignId } from '#lib/designs/index.js';

	interface Props {
		name: string;
		value?: DesignId;
	}

	let { name, value = $bindable('editorial') }: Props = $props();
</script>

<div class="designs" role="radiogroup" aria-label="Design">
	{#each DESIGNS as design (design.id)}
		<div class="design" class:checked={value === design.id}>
			<label>
				<input type="radio" {name} value={design.id} bind:group={value} />
				<span class="text">
					<span class="design-name">{design.name}</span>
					<span class="hint">{design.description}</span>
				</span>
			</label>
			<a
				class="preview"
				href="/?design={design.id}"
				target="_blank"
				rel="noopener"
				aria-label="Preview the {design.name} design in a new tab"
				title="Preview without saving"
			>
				<ExternalLink size={14} strokeWidth={1.5} />
			</a>
		</div>
	{/each}
</div>

<style>
	.designs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
		gap: 0.75rem;
	}

	.design {
		position: relative;
		display: flex;
		align-items: stretch;
		border: 1px solid var(--border);
		background: var(--bg);
		transition: border-color 0.2s var(--ease);
	}

	.design:hover {
		border-color: var(--border-strong);
	}

	.design.checked {
		border-color: var(--highlight, var(--text));
		box-shadow: inset 0 0 0 1px var(--highlight, var(--text));
	}

	label {
		flex: 1;
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.9rem 0 0.9rem 1rem;
		cursor: pointer;
		min-width: 0;
	}

	input {
		margin: 0.3rem 0 0;
		accent-color: var(--highlight, var(--text));
	}

	.text {
		display: grid;
		gap: 0.2rem;
	}

	.design-name {
		font-size: 0.95rem;
		color: var(--text);
	}

	.preview {
		display: grid;
		place-items: center;
		width: 44px;
		flex: none;
		color: var(--text-muted);
		transition: color 0.2s var(--ease);
	}

	.preview:hover {
		color: var(--text);
	}
</style>
