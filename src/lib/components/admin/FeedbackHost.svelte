<script lang="ts">
	import { fade, fly, scale } from 'svelte/transition';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { feedback } from './feedback.svelte.js';

	let confirmButton = $state<HTMLButtonElement>();

	$effect(() => {
		if (feedback.confirmation) confirmButton?.focus();
	});

	function onkeydown(event: KeyboardEvent) {
		if (feedback.confirmation && event.key === 'Escape') feedback.confirmation.resolve(false);
	}
</script>

<svelte:window {onkeydown} />

<div class="toasts" aria-live="polite">
	{#each feedback.toasts as toast (toast.id)}
		<div class="toast {toast.kind}" in:fly={{ y: 16, duration: 250 }} out:fade={{ duration: 200 }}>
			{#if toast.kind === 'error'}<TriangleAlert size={16} />{:else}<CircleCheck size={16} />{/if}
			<span>{toast.message}</span>
			<button onclick={() => feedback.dismiss(toast.id)} aria-label="Dismiss">
				<X size={14} />
			</button>
		</div>
	{/each}
</div>

{#if feedback.confirmation}
	{@const request = feedback.confirmation}
	<div class="backdrop" transition:fade={{ duration: 180 }}>
		<div
			class="dialog"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="confirm-title"
			aria-describedby="confirm-message"
			transition:scale={{ start: 0.96, duration: 200 }}
		>
			<h2 id="confirm-title">{request.title}</h2>
			<p id="confirm-message">{request.message}</p>
			<div class="buttons">
				<button class="btn btn-sm btn-quiet" onclick={() => request.resolve(false)}>Cancel</button>
				<button
					bind:this={confirmButton}
					class="btn btn-sm {request.danger ? 'btn-danger' : 'btn-solid'}"
					onclick={() => request.resolve(true)}
				>
					{request.confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.toasts {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 300;
		display: grid;
		gap: 0.5rem;
		width: min(380px, calc(100vw - 2rem));
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.8rem 0.9rem;
		background: var(--text);
		color: var(--bg);
		font-size: 0.86rem;
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.18);
	}

	.toast.error {
		background: var(--danger);
		color: #fff;
	}

	.toast span {
		flex: 1;
	}

	.toast button {
		display: grid;
		place-items: center;
		border: 0;
		background: none;
		color: inherit;
		opacity: 0.7;
		cursor: pointer;
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 250;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(20, 18, 15, 0.45);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
	}

	.dialog {
		width: min(100%, 420px);
		padding: 1.75rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		box-shadow: 0 30px 80px rgba(0, 0, 0, 0.25);
	}

	h2 {
		font-size: 1.5rem;
	}

	p {
		margin-top: 0.75rem;
		color: var(--text-muted);
		font-size: 0.92rem;
	}

	.buttons {
		display: flex;
		justify-content: flex-end;
		gap: 0.6rem;
		margin-top: 1.75rem;
	}
</style>
