<script lang="ts">
	import { Button, Dialog } from 'm3-svelte';
	import { confirmState, settleConfirm } from '$lib/confirm.svelte';

	let open = $state(false);
	let headline = $state('');
	let message = $state('');
	let confirmLabel = $state('Delete');

	$effect(() => {
		const current = confirmState.current;
		if (current) {
			headline = current.headline;
			message = current.message;
			confirmLabel = current.confirmLabel ?? 'Delete';
		}
		open = !!current;
	});
</script>

<Dialog
	bind:open
	{headline}
	onEsc={() => settleConfirm(false)}
	onClick={() => settleConfirm(false)}
>
	<p>{message}</p>
	{#snippet buttons()}
		<Button variant="text" onclick={() => settleConfirm(false)}>Cancel</Button>
		<Button variant="filled" onclick={() => settleConfirm(true)}>{confirmLabel}</Button>
	{/snippet}
</Dialog>
