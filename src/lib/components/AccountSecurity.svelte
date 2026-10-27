<script lang="ts">
	import { Button, Card, Checkbox } from 'm3-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { Passkey } from '@better-auth/passkey';
	import { authClient, errorMessage, signOut, verifiedURL, type AuthError } from '$lib/api/auth';
	import { emailSchema, firstIssue, passwordSchema } from '$shared/validation/account';

	const inputClass =
		'bg-surface text-on-surface placeholder:text-on-surface-variant/70 ring-outline focus:ring-primary w-full rounded-lg px-3 py-2 ring-1 focus:ring-2 focus:outline-none';

	let email = $state('');
	let newEmail = $state('');
	let currentPassword = $state('');
	let newPassword = $state('');
	let signOutOthers = $state(true);
	let passkeys = $state<Passkey[]>([]);
	let busy = $state(false);
	let message = $state('');

	let emailIssue = $derived(
		newEmail ? firstIssue(emailSchema.safeParse(newEmail.trim())) : undefined
	);
	let passwordIssue = $derived(
		newPassword ? firstIssue(passwordSchema.safeParse(newPassword)) : undefined
	);

	async function run(action: () => Promise<AuthError>, success: string) {
		busy = true;
		message = '';
		const error = await action();
		busy = false;
		message = error ? errorMessage(error) : success;
		return !error;
	}

	async function loadPasskeys() {
		const { data } = await authClient.passkey.listUserPasskeys();
		passkeys = data ?? [];
	}

	async function changeEmail() {
		const target = newEmail.trim();
		const changed = await run(
			async () =>
				(await authClient.changeEmail({ newEmail: target, callbackURL: verifiedURL() })).error,
			`Open the link we sent to ${target} to confirm your new email.`
		);
		if (changed) newEmail = '';
	}

	async function changePassword() {
		const changed = await run(
			async () =>
				(
					await authClient.changePassword({
						currentPassword,
						newPassword,
						revokeOtherSessions: signOutOthers
					})
				).error,
			'Your password was changed.'
		);
		if (changed) currentPassword = newPassword = '';
	}

	async function addPasskey() {
		if (await run(async () => (await authClient.passkey.addPasskey()).error, 'Passkey added.')) {
			await loadPasskeys();
		}
	}

	async function deletePasskey(id: string) {
		if (
			await run(
				async () => (await authClient.passkey.deletePasskey({ id })).error,
				'Passkey removed.'
			)
		) {
			await loadPasskeys();
		}
	}

	async function leave(everywhere: boolean) {
		if (await run(() => signOut(everywhere), '')) goto(resolve('/login'));
	}

	onMount(async () => {
		const { data } = await authClient.getSession();
		email = data?.user.email ?? '';
		await loadPasskeys();
	});
</script>

<section class="flex flex-col gap-3">
	<div class="flex items-center justify-between">
		<div class="flex flex-col gap-1">
			<p class="text-on-surface-variant text-xs tracking-[0.16em] uppercase">Security</p>
			<p class="text-on-surface-variant text-sm">Manage how you sign in.</p>
		</div>
	</div>

	<Card variant="outlined" class="flex flex-col gap-6 p-6">
		<div class="flex flex-col gap-5">
			<div
				class="bg-surface-container-high ring-outline/50 flex flex-col gap-3 rounded-xl p-4 ring-1"
			>
				<p class="text-on-surface text-xs font-semibold tracking-wide uppercase">Email</p>
				<p class="text-on-surface text-lg font-semibold">{email || 'Not available'}</p>
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
					<input
						type="email"
						autocomplete="email"
						bind:value={newEmail}
						placeholder="New email address"
						class={`${inputClass} min-w-0 sm:flex-1`}
					/>
					<Button
						variant="outlined"
						style="flex-shrink: 0; white-space: nowrap;"
						onclick={changeEmail}
						disabled={busy || !newEmail || !!emailIssue}>Change email</Button
					>
				</div>
				{#if emailIssue}<p class="text-error text-xs">{emailIssue}</p>{/if}
			</div>

			<div
				class="bg-surface-container-high ring-outline/50 flex flex-col gap-3 rounded-xl p-4 ring-1"
			>
				<p class="text-on-surface text-xs font-semibold tracking-wide uppercase">Password</p>
				<input
					type="password"
					autocomplete="current-password"
					bind:value={currentPassword}
					placeholder="Current password"
					class={inputClass}
				/>
				<input
					type="password"
					autocomplete="new-password"
					bind:value={newPassword}
					placeholder="New password"
					class={inputClass}
				/>
				<p class="text-xs {passwordIssue ? 'text-error' : 'text-on-surface-variant'}">
					{passwordIssue ?? '8-128 characters with an uppercase and a lowercase letter.'}
				</p>
				<div class="flex items-center justify-between gap-4">
					<label class="text-on-surface-variant flex items-center gap-2 text-sm">
						<Checkbox><input type="checkbox" bind:checked={signOutOthers} /></Checkbox>
						Sign out other devices
					</label>
					<Button
						variant="outlined"
						onclick={changePassword}
						disabled={busy || !currentPassword || !newPassword || !!passwordIssue}
						>Change password</Button
					>
				</div>
			</div>

			<div
				class="bg-surface-container-high ring-outline/50 flex flex-col gap-3 rounded-xl p-4 ring-1"
			>
				<div class="flex items-center justify-between gap-4">
					<div class="flex flex-col gap-1">
						<p class="text-on-surface text-xs font-semibold tracking-wide uppercase">Passkeys</p>
						<p class="text-on-surface-variant text-xs">
							Sign in with your fingerprint, face or device PIN.
						</p>
					</div>
					<Button variant="outlined" onclick={addPasskey} disabled={busy}>Add passkey</Button>
				</div>
				{#each passkeys as passkey (passkey.id)}
					<div class="flex items-center justify-between gap-4">
						<div class="flex flex-col">
							<p class="text-on-surface text-sm font-semibold">{passkey.name || 'Passkey'}</p>
							<p class="text-on-surface-variant text-xs">
								Added {new Date(passkey.createdAt).toLocaleDateString()}
							</p>
						</div>
						<Button variant="text" onclick={() => deletePasskey(passkey.id)} disabled={busy}
							>Remove</Button
						>
					</div>
				{:else}
					<p class="text-on-surface-variant text-sm">No passkeys yet.</p>
				{/each}
			</div>

			{#if message}<p class="text-on-surface-variant text-sm" role="status">{message}</p>{/if}

			<div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
				<Button variant="outlined" onclick={() => leave(true)} disabled={busy}
					>Sign out everywhere</Button
				>
				<Button variant="filled" onclick={() => leave(false)} disabled={busy}>Sign out</Button>
			</div>
		</div>
	</Card>
</section>
