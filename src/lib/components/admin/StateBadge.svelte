<script lang="ts">
	import type { BookingStatus, InvoiceState, PaymentState } from '#lib/types.js';

	type State = PaymentState | InvoiceState | BookingStatus;

	let { state, href }: { state: State; href?: string } = $props();

	const labels: Record<State, string> = {
		paid: 'Paid',
		'part-paid': 'Part paid',
		unpaid: 'Unpaid',
		overdue: 'Overdue',
		draft: 'Draft',
		'not-invoiced': 'Not invoiced',
		confirmed: 'Confirmed',
		tentative: 'Tentative',
		cancelled: 'Cancelled'
	};

	const tone: Partial<Record<State, string>> = {
		paid: 'ok',
		confirmed: 'ok',
		'part-paid': 'warn',
		tentative: 'warn',
		overdue: 'danger',
		cancelled: 'danger'
	};
</script>

<svelte:element this={href ? 'a' : 'span'} {href} class="ui-badge {tone[state] ?? ''}">
	{labels[state]}
</svelte:element>
