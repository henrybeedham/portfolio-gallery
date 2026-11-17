<script lang="ts">
	import type { Stage } from '#lib/job-stage.js';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ImageUp from '@lucide/svelte/icons/image-up';
	import Receipt from '@lucide/svelte/icons/receipt';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Calendar from '@lucide/svelte/icons/calendar';
	import CircleQuestionMark from '@lucide/svelte/icons/circle-question-mark';
	import CircleCheck from '@lucide/svelte/icons/circle-check';

	let { stage, size = 15 }: { stage: Stage; size?: number } = $props();

	const icons = {
		overdue: CircleAlert,
		deliver: ImageUp,
		invoice: Receipt,
		awaiting: Hourglass,
		upcoming: Calendar,
		tentative: CircleQuestionMark,
		done: CircleCheck
	};
	const Icon = $derived(icons[stage]);
</script>

<Icon {size} strokeWidth={1.5} />
