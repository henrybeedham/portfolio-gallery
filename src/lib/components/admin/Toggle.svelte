<script lang="ts">
	interface Props {
		name?: string;
		label: string;
		description?: string;
		checked?: boolean;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	}

	let {
		name,
		label,
		description,
		checked = $bindable(false),
		disabled = false,
		onchange
	}: Props = $props();
</script>

<label class="toggle" class:disabled>
	<input type="checkbox" {name} bind:checked {disabled} onchange={() => onchange?.(checked)} />
	<span class="track" aria-hidden="true"><span class="thumb"></span></span>
	<span class="text">
		<span class="toggle-label">{label}</span>
		{#if description}<span class="description">{description}</span>{/if}
	</span>
</label>

<style>
	.toggle {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		cursor: pointer;
	}

	.toggle.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.track {
		position: relative;
		flex: none;
		width: 36px;
		height: 20px;
		margin-top: 1px;
		border: 1px solid var(--border-strong);
		background: var(--surface);
		transition:
			background-color 0.2s var(--ease),
			border-color 0.2s var(--ease);
	}

	.thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 12px;
		height: 12px;
		background: var(--text-subtle);
		transition:
			transform 0.25s var(--ease),
			background-color 0.2s var(--ease);
	}

	input:checked + .track {
		background: var(--text);
		border-color: var(--text);
	}

	input:checked + .track .thumb {
		transform: translateX(16px);
		background: var(--bg);
	}

	input:focus-visible + .track {
		outline: 1px solid var(--text);
		outline-offset: 3px;
	}

	.text {
		display: grid;
		gap: 0.15rem;
	}

	.toggle-label {
		font-size: 0.92rem;
	}

	.description {
		font-size: 0.8rem;
		color: var(--text-subtle);
		line-height: 1.45;
	}
</style>
