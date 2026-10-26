<script lang="ts">
	import { Button, TextFieldOutlined } from 'm3-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { isLoggedIn } from '$lib/store';
	import { onMount } from 'svelte';
	import { title } from '$lib/store';
	import {
		authClient,
		enrollLegacyAccount,
		errorMessage,
		loadSession,
		verifiedURL,
		type AuthError
	} from '$lib/api/auth';
	import VerifyEmail from '$lib/components/VerifyEmail.svelte';
	import { emailSchema, firstIssue, usernameSchema } from '$shared/validation/account';

	let username = $state('');
	let password = $state('');
	let mode = $state<'signin' | 'enroll' | 'verify'>('signin');
	let email = $state('');
	let newUsername = $state('');
	let needsNewUsername = $state(false);
	let renamed = $state('');
	let message = $state('');
	let busy = $state(false);

	let usesEmail = $derived(emailSchema.safeParse(username.trim()).success);
	let emailIssue = $derived(email ? firstIssue(emailSchema.safeParse(email.trim())) : undefined);
	let newUsernameIssue = $derived(
		newUsername ? firstIssue(usernameSchema.safeParse(newUsername)) : undefined
	);

	function signIn() {
		const callbackURL = verifiedURL();
		return usesEmail
			? authClient.signIn.email({ email: username.trim(), password, callbackURL })
			: authClient.signIn.username({ username, password, callbackURL });
	}

	async function finish() {
		if (!(await loadSession(true))) {
			message = 'You are signed in, but your profile could not be loaded. Try again.';
		}
	}

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!username || !password || busy) return;
		busy = true;
		message = '';
		const { error } = await signIn();
		busy = false;
		if (!error) return finish();
		if (error.code === 'LEGACY_ENROLLMENT_REQUIRED') {
			mode = 'enroll';
		} else if (error.code === 'EMAIL_NOT_VERIFIED') {
			email = usesEmail ? username.trim() : '';
			mode = 'verify';
		} else {
			message = errorMessage(error);
		}
	}

	async function resend(): Promise<AuthError> {
		const { error } = await signIn();
		if (!error) void finish();
		return error?.code === 'EMAIL_NOT_VERIFIED' ? null : error;
	}

	async function signInWithPasskey() {
		busy = true;
		message = '';
		const { error } = await authClient.signIn.passkey();
		busy = false;
		if (error) message = errorMessage(error, 'Passkey sign-in did not finish.');
		else await finish();
	}

	async function enroll(event: SubmitEvent) {
		event.preventDefault();
		if (
			busy ||
			!password ||
			!email ||
			emailIssue ||
			(needsNewUsername && (!newUsername || newUsernameIssue))
		) {
			return;
		}
		busy = true;
		message = '';
		const replacement = needsNewUsername ? newUsername : undefined;
		const { data, error } = await enrollLegacyAccount({
			username,
			password,
			email: email.trim(),
			newUsername: replacement
		});
		busy = false;
		if (replacement && (!error || error.code === 'EMAIL_DELIVERY_FAILED')) {
			username = replacement;
			renamed = replacement;
			needsNewUsername = false;
		}
		if (data) {
			email = data.email;
			mode = 'verify';
			return;
		}
		if (error?.code === 'USERNAME_REPLACEMENT_REQUIRED') needsNewUsername = true;
		message = errorMessage(error);
	}

	$effect(() => {
		if ($isLoggedIn) {
			void goto(resolve('/'), { replaceState: true });
		}
	});

	onMount(async () => {
		title.set('Login');
	});
</script>

<div class="flex h-full w-full items-center justify-center p-4">
	<div
		class="bg-surface-container-high mt-10 flex w-full max-w-md flex-col gap-8 rounded-3xl p-8 shadow-md"
	>
		{#if mode === 'verify'}
			<VerifyEmail bind:email username={usesEmail ? '' : username} {password} {resend} />
		{:else if mode === 'enroll'}
			<div class="flex flex-col gap-2 text-center">
				<h1 class="text-on-surface text-4xl font-medium tracking-tight">Add your email</h1>
				<p class="text-on-surface-variant text-base">
					Maple accounts now need a verified email address. Add one to finish moving your account.
				</p>
			</div>

			<form onsubmit={enroll} class="flex flex-col gap-6">
				<div class="flex flex-col gap-1">
					<TextFieldOutlined
						label="Original username"
						autocomplete="username"
						bind:value={username}
					/>
					<p class="text-on-surface-variant text-sm">
						Enter it exactly as before, or leave it empty if your old username was blank.
					</p>
				</div>
				<TextFieldOutlined
					label="Password"
					bind:value={password}
					type="password"
					autocomplete="current-password"
				/>
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
				{#if needsNewUsername}
					<div class="flex flex-col gap-1">
						<TextFieldOutlined
							label="New username"
							autocomplete="username"
							bind:value={newUsername}
							error={!!newUsernameIssue}
						/>
						<p class="text-sm {newUsernameIssue ? 'text-error' : 'text-on-surface-variant'}">
							{newUsernameIssue ?? '2-32 letters, digits, dots, dashes or underscores.'}
						</p>
					</div>
				{/if}
				{#if renamed}
					<p class="text-on-surface-variant text-sm">Your username is now {renamed}.</p>
				{/if}
				{#if message}<p class="text-error text-sm" role="alert">{message}</p>{/if}
				<div class="flex flex-col gap-3 pt-2">
					<Button variant="filled" type="submit" disabled={busy}>Send verification link</Button>
				</div>
			</form>
		{:else}
			<div class="flex flex-col gap-2 text-center">
				<h1 class="text-on-surface text-4xl font-medium tracking-tight">Welcome back</h1>
				<p class="text-on-surface-variant text-base">Sign in to continue to Maple.</p>
			</div>

			<form onsubmit={onSubmit} class="flex flex-col gap-6">
				<TextFieldOutlined
					label="Email or username"
					autocomplete="username webauthn"
					bind:value={username}
				/>
				<TextFieldOutlined
					label="Password"
					bind:value={password}
					type="password"
					autocomplete="current-password"
				/>
				{#if message}<p class="text-error text-sm" role="alert">{message}</p>{/if}
				<div class="flex flex-col gap-3 pt-2">
					<Button variant="filled" type="submit" disabled={busy}>Sign in</Button>
					<Button variant="outlined" onclick={signInWithPasskey} disabled={busy}
						>Sign in with a passkey</Button
					>
					<Button variant="text" onclick={() => goto(resolve('/reset-password'))}
						>Forgot password?</Button
					>
					<Button variant="text" onclick={() => ((mode = 'enroll'), (message = ''))}
						>Move an existing account</Button
					>
				</div>
			</form>
		{/if}

		<div class="flex items-center gap-4">
			<div class="bg-outline-variant h-px flex-1"></div>
			<span class="text-on-surface-variant text-sm">or</span>
			<div class="bg-outline-variant h-px flex-1"></div>
		</div>

		<div class="flex flex-col gap-3">
			{#if mode === 'signin'}
				<Button variant="outlined" onclick={() => goto(resolve('/register'))}
					>Create an account</Button
				>
			{:else}
				<Button variant="outlined" onclick={() => ((mode = 'signin'), (message = ''))}
					>Back to sign in</Button
				>
			{/if}
		</div>
	</div>
</div>
