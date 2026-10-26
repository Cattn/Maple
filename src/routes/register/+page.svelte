<script lang="ts">
	import { Button, TextFieldOutlined } from 'm3-svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { ZodType } from 'zod';
	import { title } from '$lib/store';
	import { authClient, errorMessage, verifiedURL } from '$lib/api/auth';
	import VerifyEmail from '$lib/components/VerifyEmail.svelte';
	import {
		emailSchema,
		firstIssue,
		passwordSchema,
		usernameSchema
	} from '$shared/validation/account';

	let email = $state('');
	let username = $state('');
	let password = $state('');
	let sentTo = $state('');
	let message = $state('');
	let busy = $state(false);

	const issue = (schema: ZodType, value: string) =>
		value ? firstIssue(schema.safeParse(value)) : undefined;
	let emailIssue = $derived(issue(emailSchema, email.trim()));
	let usernameIssue = $derived(issue(usernameSchema, username));
	let passwordIssue = $derived(issue(passwordSchema, password));
	let valid = $derived(
		!!email && !!username && !!password && !emailIssue && !usernameIssue && !passwordIssue
	);

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!valid || busy) return;
		busy = true;
		message = '';
		const { error } = await authClient.signUp.email({
			email: email.trim(),
			username,
			name: username,
			password,
			callbackURL: verifiedURL()
		});
		busy = false;
		if (error) message = errorMessage(error);
		else sentTo = email.trim();
	}

	async function resend() {
		const { error } = await authClient.sendVerificationEmail({
			email: sentTo,
			callbackURL: verifiedURL()
		});
		return error;
	}

	onMount(async () => {
		title.set('Register');
	});
</script>

<div class="flex h-full w-full items-center justify-center p-4">
	<div
		class="bg-surface-container-high mt-10 flex w-full max-w-md flex-col gap-8 rounded-3xl p-8 shadow-md"
	>
		{#if sentTo}
			<VerifyEmail bind:email={sentTo} {username} {password} {resend} />
		{:else}
			<div class="flex flex-col gap-2 text-center">
				<h1 class="text-on-surface text-4xl font-medium tracking-tight">Create an account</h1>
				<p class="text-on-surface-variant text-base">Join Maple to start listening with friends.</p>
			</div>

			<form onsubmit={onSubmit} class="flex flex-col gap-6">
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
				<div class="flex flex-col gap-1">
					<TextFieldOutlined
						label="Username"
						autocomplete="username"
						bind:value={username}
						error={!!usernameIssue}
					/>
					<p class="text-sm {usernameIssue ? 'text-error' : 'text-on-surface-variant'}">
						{usernameIssue ?? '2-32 letters, digits, dots, dashes or underscores.'}
					</p>
				</div>
				<div class="flex flex-col gap-1">
					<TextFieldOutlined
						label="Password"
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
				<div class="flex flex-col gap-3 pt-2">
					<Button variant="filled" type="submit" disabled={busy || !valid}>Sign up</Button>
				</div>
			</form>
		{/if}

		<div class="flex items-center gap-4">
			<div class="bg-outline-variant h-px flex-1"></div>
			<span class="text-on-surface-variant text-sm">or</span>
			<div class="bg-outline-variant h-px flex-1"></div>
		</div>

		<div class="flex flex-col gap-3">
			<Button variant="outlined" onclick={() => goto('/login')}
				>Already have an account? Sign in</Button
			>
		</div>
	</div>
</div>
