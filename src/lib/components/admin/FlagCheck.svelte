<script lang="ts">
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		on: boolean;
		label: string;
		busy?: boolean;
		disabled?: boolean;
		onclick: () => void;
	}

	let { on, label, busy = false, disabled = false, onclick }: Props = $props();
</script>

<button
	type="button"
	class="ui-check"
	class:on
	aria-pressed={on}
	aria-label={label}
	title={label}
	disabled={disabled || busy}
	{onclick}
>
	{#if busy}
		<span class="spinner" style:color={on ? 'var(--bg)' : 'var(--text-muted)'}></span>
	{:else if on}
		<Check size={14} strokeWidth={2} />
	{/if}
</button>
