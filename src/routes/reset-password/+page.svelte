<script lang="ts">
	import { Button, TextFieldOutlined } from 'm3-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { title } from '$lib/store';
	import { authClient, errorMessage } from '$lib/api/auth';
	import { emailSchema, firstIssue, passwordSchema } from '$shared/validation/account';

	let email = $state('');
	let password = $state('');
	let message = $state('');
	let done = $state(false);
	let busy = $state(false);

	let token = $derived(page.url.searchParams.get('token'));
	let linkError = $derived(!!page.url.searchParams.get('error'));
	let emailIssue = $derived(email ? firstIssue(emailSchema.safeParse(email.trim())) : undefined);
	let passwordIssue = $derived(
		password ? firstIssue(passwordSchema.safeParse(password)) : undefined
	);

	async function requestReset(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !email || emailIssue) return;
		busy = true;
		message = '';
		const { error } = await authClient.requestPasswordReset({
			email: email.trim(),
			redirectTo: `${window.location.origin}/reset-password`
		});
		busy = false;
		done = !error;
		message = error
			? errorMessage(error)
			: 'If an account uses that email, we sent a link to reset your password.';
	}

	async function resetPassword(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !token || !password || passwordIssue) return;
		busy = true;
		message = '';
		const { error } = await authClient.resetPassword({ newPassword: password, token });
		busy = false;
		done = !error;
		message = error
			? errorMessage(error)
			: 'Your password was changed and other devices were signed out. Sign in to continue.';
	}

	onMount(() => {
		title.set('Reset password');
	});
</script>

<div class="flex h-full w-full items-center justify-center p-4">
	<div
		class="bg-surface-container-high mt-10 flex w-full max-w-md flex-col gap-8 rounded-3xl p-8 shadow-md"
	>
		<div class="flex flex-col gap-2 text-center">
			<h1 class="text-on-surface text-4xl font-medium tracking-tight">Reset password</h1>
			<p class="text-on-surface-variant text-base">
				{#if linkError}
					This link is invalid or has expired. Request a new one below.
				{:else if token}
					Choose a new password for your account.
				{:else}
					Enter your account email and we will send you a reset link.
				{/if}
			</p>
		</div>

		{#if done}
			<p class="text-on-surface-variant text-center text-sm" role="status">{message}</p>
		{:else if token && !linkError}
			<form onsubmit={resetPassword} class="flex flex-col gap-6">
				<div class="flex flex-col gap-1">
					<TextFieldOutlined
						label="New password"
						type="password"
						autocomplete="new-password"
						bind:value={password}
						error={!!passwordIssue}
					/>
					<p class="text-sm {passwordIssue ? 'text-error' : 'text-on-surface-variant'}">
						{passwordIssue ?? '8-128 characters with an uppercase and a lowercase letter.'}
					</p>
				</div>
				{#if message}<p class="text-error text-sm" role="alert">{message}</p>{/if}
				<Button variant="filled" type="submit" disabled={busy || !password || !!passwordIssue}
					>Change password</Button
				>
			</form>
		{:else}
			<form onsubmit={requestReset} class="flex flex-col gap-6">
				<div class="flex flex-col gap-1">
					<TextFieldOutlined
						label="Email"
						type="email"
						autocomplete="email"
						bind:value={email}
						error={!!emailIssue}
					/>
					{#if emailIssue}<p class="text-error text-sm">{emailIssue}</p>{/if}
				</div>
				{#if message}<p class="text-error text-sm" role="alert">{message}</p>{/if}
				<Button variant="filled" type="submit" disabled={busy || !email || !!emailIssue}
					>Send reset link</Button
				>
			</form>
		{/if}

		<div class="flex flex-col gap-3">
			<Button variant="outlined" onclick={() => goto(resolve('/login'))}>Back to sign in</Button>
		</div>
	</div>
</div>
