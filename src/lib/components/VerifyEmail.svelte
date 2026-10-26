<script lang="ts">
	import { Button, TextFieldOutlined } from 'm3-svelte';
	import { enrollLegacyAccount, errorMessage, loadSession, type AuthError } from '$lib/api/auth';
	import { onMount } from 'svelte';
	import { emailSchema, firstIssue } from '$shared/validation/account';

	let {
		email = $bindable(),
		username,
		password,
		resend
	}: {
		email: string;
		username: string;
		password: string;
		resend: () => Promise<AuthError>;
	} = $props();

	let changing = $state(false);
	let newEmail = $state('');
	let busy = $state(false);
	let message = $state('');
	let emailIssue = $derived(
		newEmail ? firstIssue(emailSchema.safeParse(newEmail.trim())) : undefined
	);

	onMount(() => {
		const checkSession = () => {
			if (document.visibilityState === 'visible') void loadSession();
		};
		checkSession();
		const interval = window.setInterval(checkSession, 5000);
		return () => window.clearInterval(interval);
	});

	async function run(action: () => Promise<AuthError>, success: string) {
		busy = true;
		message = '';
		const error = await action();
		busy = false;
		message = error ? errorMessage(error) : success;
		return error;
	}

	async function changeEmail(event: SubmitEvent) {
		event.preventDefault();
		if (!newEmail || emailIssue) return;
		const target = newEmail.trim();
		const error = await run(
			async () => (await enrollLegacyAccount({ username, password, email: target })).error,
			'We sent a new link.'
		);
		if (!error || error.code === 'EMAIL_DELIVERY_FAILED') {
			email = target;
			changing = false;
		}
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-2 text-center">
		<h1 class="text-on-surface text-4xl font-medium tracking-tight">Check your email</h1>
		<p class="text-on-surface-variant text-base">
			{#if email}
				We sent a verification link to <span class="text-on-surface font-medium">{email}</span>.
			{:else}
				We sent a verification link to your email address.
			{/if}
			Open it to finish signing in.
		</p>
	</div>

	{#if changing}
		<form onsubmit={changeEmail} class="flex flex-col gap-3">
			<TextFieldOutlined
				label="Email"
				type="email"
				autocomplete="email"
				bind:value={newEmail}
				error={!!emailIssue}
			/>
			{#if emailIssue}<p class="text-error text-sm">{emailIssue}</p>{/if}
			<Button variant="filled" type="submit" disabled={busy || !newEmail || !!emailIssue}
				>Send link</Button
			>
		</form>
	{/if}

	{#if message}<p class="text-on-surface-variant text-center text-sm" role="status">
			{message}
		</p>{/if}

	<div class="flex flex-col gap-3">
		<Button variant="outlined" disabled={busy} onclick={() => run(resend, 'We sent another link.')}>
			Resend email
		</Button>
		{#if !changing && username}
			<Button variant="text" onclick={() => (changing = true)}>Use a different email</Button>
		{/if}
	</div>
</div>
