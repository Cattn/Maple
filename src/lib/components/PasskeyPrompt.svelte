<script lang="ts">
	import { Button, Dialog } from 'm3-svelte';
	import { authClient, errorMessage } from '$lib/api/auth';
	import { SavedUser } from '$lib/store';

	let open = $state(false);
	let adding = $state(false);
	let message = $state('');
	let checked = '';

	const key = (id: string) => `passkeyPrompt.${id}`;

	$effect(() => {
		const id = $SavedUser?.id;
		if (!id) {
			open = false;
			checked = '';
		}
		if (!id || id === checked) return;
		checked = id;
		if (localStorage.getItem(key(id))) return;
		void authClient.passkey.listUserPasskeys().then(({ data }) => {
			if (!data || checked !== id) return;
			if (data.length > 0) localStorage.setItem(key(id), 'done');
			else open = true;
		});
	});

	function dismiss() {
		if (checked) localStorage.setItem(key(checked), 'dismissed');
		open = false;
	}

	async function add() {
		adding = true;
		message = '';
		const { error } = await authClient.passkey.addPasskey();
		adding = false;
		if (error) message = errorMessage(error, 'The passkey was not added.');
		else dismiss();
	}
</script>

<Dialog bind:open headline="Add a passkey?" onEsc={dismiss} onClick={dismiss}>
	<p>
		Sign in with your fingerprint, face or device PIN instead of your password. You can manage
		passkeys in Settings.
	</p>
	{#if message}
		<p class="text-error mt-2 text-sm" role="alert">{message}</p>
	{/if}
	{#snippet buttons()}
		<Button variant="text" onclick={dismiss}>Not now</Button>
		<Button variant="filled" onclick={add} disabled={adding}>Add passkey</Button>
	{/snippet}
</Dialog>
